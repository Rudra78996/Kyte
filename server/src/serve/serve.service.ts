import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Response } from 'express';
import * as mime from 'mime-types';

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

  async serveFile(projectSlug: string, path: string, res: Response) {
    const project = await this.prisma.project.findUnique({
      where: { subdomain: projectSlug },
      include: { activeDeploy: true },
    });

    if (!project || !project.activeDeploy) {
      throw new NotFoundException('Project or active deployment not found');
    }

    const prefix = project.activeDeploy.s3Prefix;
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

    (s3Response.Body as NodeJS.ReadableStream).pipe(res);
  }
}
