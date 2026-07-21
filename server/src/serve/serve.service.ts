import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Response, Request } from 'express';
import * as mime from 'mime-types';
import * as geoip from 'geoip-lite';
import { requireEnvironment } from '../common/runtime-config';

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
    if (s3Response.CacheControl) {
      res.setHeader('Cache-Control', s3Response.CacheControl);
    }

    res.on('finish', () => {
      const responseTime = Math.round(performance.now() - startTime);

      let ip =
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        '127.0.0.1';
      if (ip.includes(',')) ip = ip.split(',')[0].trim();

      let country = null;
      let countryCode = null;
      if (ip) {
        const geo = geoip.lookup(ip);
        if (geo) {
          countryCode = geo.country;
          const displayNames: Record<string, string> = {
            US: 'United States',
            IN: 'India',
            GB: 'United Kingdom',
            DE: 'Germany',
            FR: 'France',
            CA: 'Canada',
            AU: 'Australia',
          };
          country = displayNames[geo.country] || geo.country;
        } else if (
          ip === '127.0.0.1' ||
          ip === '::1' ||
          ip.startsWith('172.')
        ) {
          countryCode = 'US';
          country = 'United States (Local)';
        }
      }

      if (projectId) {
        const isAsset = targetPath.match(
          /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i,
        );

        if (!isAsset) {
          this.prisma.requestLog
            .create({
              data: {
                projectId,
                method: req.method,
                path: '/' + targetPath,
                statusCode: res.statusCode,
                responseTime,
                ipAddress: ip,
                countryCode,
                country,
              },
            })
            .catch((err) => console.error('Failed to log request:', err));
        }
      }
    });

    (s3Response.Body as NodeJS.ReadableStream).pipe(res);
  }
}
