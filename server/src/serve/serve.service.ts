import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Response, Request } from 'express';
import * as mime from 'mime-types';
import * as geoip from 'geoip-lite';

@Injectable()
export class ServeService {
  private s3: S3Client;
  private bucket: string;

  constructor(private prisma: PrismaService) {
    this.bucket = process.env.MINIO_BUCKET || 'deployly-projects';
    this.s3 = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'admin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'password',
      },
      forcePathStyle: true,
    });
  }

  async serveFile(projectSlug: string, path: string, res: Response, req: Request) {
    const startTime = performance.now();
    let prefix: string | null = null;
    let projectId: string | null = null;

    const project = await this.prisma.project.findUnique({
      where: { subdomain: projectSlug },
      include: { activeDeploy: true },
    });

    if (project) {
      if (!project.activeDeploy) {
        throw new NotFoundException('Project has no active deployment');
      }
      prefix = project.activeDeploy.s3Prefix;
      projectId = project.id;
    } else {
      const deployment = await this.prisma.deployment.findUnique({
        where: { id: projectSlug },
      });
      if (deployment) {
        prefix = deployment.s3Prefix;
        projectId = deployment.projectId;
      }
    }

    if (!prefix) {
      throw new NotFoundException('Project or deployment not found');
    }

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

    const contentType = s3Response.ContentType || mime.lookup(targetPath) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    if (s3Response.CacheControl) {
      res.setHeader('Cache-Control', s3Response.CacheControl);
    }

    res.on('finish', () => {
      const responseTime = Math.round(performance.now() - startTime);
      
      let ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1';
      if (ip.includes(',')) ip = ip.split(',')[0].trim();
      
      let country = null;
      let countryCode = null;
      if (ip) {
        const geo = geoip.lookup(ip);
        if (geo) {
          countryCode = geo.country;
          const displayNames: Record<string, string> = { US: 'United States', IN: 'India', GB: 'United Kingdom', DE: 'Germany', FR: 'France', CA: 'Canada', AU: 'Australia' };
          country = displayNames[geo.country] || geo.country;
        } else if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('172.')) {
          countryCode = 'US';
          country = 'United States (Local)';
        }
      }

      if (projectId) {
        const isAsset = targetPath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i);
        
        if (!isAsset) {
          this.prisma.requestLog.create({
            data: {
              projectId,
              method: req.method,
              path: '/' + targetPath,
              statusCode: res.statusCode,
              responseTime,
              ipAddress: ip,
              countryCode,
              country
            }
          }).catch(err => console.error("Failed to log request:", err));
        }
      }
    });

    (s3Response.Body as NodeJS.ReadableStream).pipe(res);
  }
}
