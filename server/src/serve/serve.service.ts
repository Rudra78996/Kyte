import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Response, Request } from 'express';
import * as mime from 'mime-types';
import * as geoip from 'geoip-lite';
import { requireEnvironment } from '../common/runtime-config';

const AUTOMATED_USER_AGENT =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pagespeed|pingdom|uptimerobot|statuscake|healthcheck|monitoring|scanner|curl|wget|httpie|postman|insomnia|python-requests|python-urllib|axios|node-fetch|undici|go-http-client|java\//i;

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function isTrackablePageView(
  req: Request,
  statusCode: number,
  contentType: string,
) {
  if (req.method !== 'GET' || statusCode < 200 || statusCode >= 400) {
    return false;
  }

  if (!contentType.toLowerCase().startsWith('text/html')) return false;

  const query = req.query as Record<string, unknown> | undefined;
  if (query?.__kyte_preview !== undefined) return false;

  const userAgent = firstHeaderValue(req.headers['user-agent'])?.trim();
  if (!userAgent || AUTOMATED_USER_AGENT.test(userAgent)) return false;

  const purpose = `${firstHeaderValue(req.headers.purpose) || ''} ${
    firstHeaderValue(req.headers['sec-purpose']) || ''
  }`;
  if (/prefetch|prerender/i.test(purpose)) return false;

  const fetchDest = firstHeaderValue(req.headers['sec-fetch-dest']);
  if (fetchDest !== 'document' && fetchDest !== 'iframe') {
    return false;
  }

  const fetchMode = firstHeaderValue(req.headers['sec-fetch-mode']);
  if (fetchMode && fetchMode !== 'navigate') return false;

  return true;
}

@Injectable()
export class ServeService {
  private s3: S3Client;
  private bucket: string;

  constructor(private prisma: PrismaService) {
    this.bucket = requireEnvironment('MINIO_BUCKET');
    this.s3 = new S3Client({
      endpoint: requireEnvironment('MINIO_ENDPOINT'),
      region: 'us-east-1',
      credentials: {
        accessKeyId: requireEnvironment('MINIO_ACCESS_KEY'),
        secretAccessKey: requireEnvironment('MINIO_SECRET_KEY'),
      },
      forcePathStyle: true,
    });
  }

  async serveFile(
    projectSlug: string,
    path: string,
    res: Response,
    req: Request,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { subdomain: projectSlug },
      include: { activeDeploy: true },
    });

    if (project) {
      if (!project.activeDeploy) {
        throw new NotFoundException('Project has no active deployment');
      }
      return this.serveDeployment(
        project.activeDeploy.s3Prefix,
        project.id,
        path,
        res,
        req,
      );
    }

    const deployment = await this.prisma.deployment.findUnique({
      where: { id: projectSlug },
    });
    if (!deployment) {
      throw new NotFoundException('Project or deployment not found');
    }
    return this.serveDeployment(
      deployment.s3Prefix,
      deployment.projectId,
      path,
      res,
      req,
    );
  }

  async serveCustomDomain(
    domainName: string,
    path: string,
    res: Response,
    req: Request,
  ) {
    const normalizedDomain = domainName.trim().toLowerCase().replace(/\.$/, '');
    const domain = await this.prisma.customDomain.findUnique({
      where: { domainName: normalizedDomain },
      include: { project: { include: { activeDeploy: true } } },
    });

    if (
      !domain ||
      domain.status !== 'verified' ||
      !domain.project.activeDeploy
    ) {
      throw new NotFoundException('Custom domain not found');
    }

    return this.serveDeployment(
      domain.project.activeDeploy.s3Prefix,
      domain.project.id,
      path,
      res,
      req,
    );
  }

  async serveHostname(host: string, path: string, res: Response, req: Request) {
    const normalizedHost = host.trim().toLowerCase().replace(/\.$/, '');
    const localProject = normalizedHost.match(
      /^([a-z0-9-]+)\.sites\.localhost$/,
    );
    if (localProject) {
      return this.serveFile(localProject[1], path, res, req);
    }

    const sitesDomain = (process.env.SITES_DOMAIN || '')
      .trim()
      .toLowerCase()
      .replace(/\.$/, '');
    if (sitesDomain && normalizedHost.endsWith(`.${sitesDomain}`)) {
      const projectSlug = normalizedHost.slice(0, -(sitesDomain.length + 1));
      if (projectSlug && !projectSlug.includes('.')) {
        return this.serveFile(projectSlug, path, res, req);
      }
    }

    return this.serveCustomDomain(normalizedHost, path, res, req);
  }

  private async serveDeployment(
    prefix: string,
    projectId: string,
    path: string,
    res: Response,
    req: Request,
  ) {
    const startTime = performance.now();
    const requestedPath = path || '';

    // Default to index.html if path is empty or a directory
    let targetPath = path || 'index.html';

    let s3Response;
    try {
      s3Response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: `${prefix}/${targetPath}`,
        }),
      );
    } catch (err: any) {
      if (err.name === 'NoSuchKey' && !targetPath.includes('.')) {
        // Fallback for SPA routing
        try {
          s3Response = await this.s3.send(
            new GetObjectCommand({
              Bucket: this.bucket,
              Key: `${prefix}/index.html`,
            }),
          );
          targetPath = 'index.html';
        } catch (fallbackErr) {
          throw new NotFoundException('File not found');
        }
      } else {
        throw new NotFoundException('File not found');
      }
    }

    const contentType =
      s3Response.ContentType ||
      mime.lookup(targetPath) ||
      'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.removeHeader('Set-Cookie');
    // Helmet protects the Kyte API from framing, but deployed customer sites
    // must be frameable by Kyte's cross-origin preview surface.
    res.removeHeader('X-Frame-Options');
    if (s3Response.CacheControl) {
      res.setHeader('Cache-Control', s3Response.CacheControl);
    }

    res.on('finish', () => {
      const responseTime = Math.round(performance.now() - startTime);

      let ip =
        firstHeaderValue(req.headers['cf-connecting-ip']) ||
        firstHeaderValue(req.headers['x-forwarded-for']) ||
        req.socket.remoteAddress ||
        '127.0.0.1';
      if (ip.includes(',')) ip = ip.split(',')[0].trim();

      let country = null;
      let countryCode = null;
      if (ip) {
        const cloudflareCountry = firstHeaderValue(
          req.headers['cf-ipcountry'],
        )?.toUpperCase();
        const geo = geoip.lookup(ip);
        const resolvedCountryCode =
          cloudflareCountry && !['XX', 'T1'].includes(cloudflareCountry)
            ? cloudflareCountry
            : geo?.country;
        if (resolvedCountryCode) {
          countryCode = resolvedCountryCode;
          try {
            country =
              new Intl.DisplayNames(['en'], { type: 'region' }).of(
                resolvedCountryCode,
              ) || resolvedCountryCode;
          } catch {
            country = resolvedCountryCode;
          }
        }
      }

      if (projectId && isTrackablePageView(req, res.statusCode, contentType)) {
        this.prisma.requestLog
          .create({
            data: {
              projectId,
              method: req.method,
              path: requestedPath ? `/${requestedPath}` : '/',
              statusCode: res.statusCode,
              responseTime,
              ipAddress: ip,
              countryCode,
              country,
              isPageView: true,
            },
          })
          .catch((err) => console.error('Failed to log request:', err));
      }
    });

    (s3Response.Body as NodeJS.ReadableStream).pipe(res);
  }
}
