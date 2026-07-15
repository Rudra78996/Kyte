import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from './prisma/prisma.service';

@Controller('api/caddy')
@SkipThrottle()
export class CaddyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('check-domain')
  async checkDomain(@Query('domain') domain: string, @Res() res: Response) {
    if (!domain) {
      return res.status(HttpStatus.BAD_REQUEST).send('Missing domain');
    }

    const normalizedDomain = domain.trim().toLowerCase().replace(/\.$/, '');
    const verifiedDomain = await this.prisma.customDomain.findUnique({
      where: { domainName: normalizedDomain },
      select: { status: true },
    });
    
    if (verifiedDomain?.status === 'verified') {
      // 200 OK tells Caddy: "Yes, we own this domain. Issue the SSL cert."
      return res.status(HttpStatus.OK).send("Allowed");
    }

    const baseDomain = (process.env.BASE_DOMAIN || '').trim().toLowerCase().replace(/\.$/, '');
    if (baseDomain && normalizedDomain.endsWith(`.${baseDomain}`)) {
      const projectSlug = normalizedDomain.slice(0, -(baseDomain.length + 1));
      if (projectSlug && !projectSlug.includes('.')) {
        const project = await this.prisma.project.findUnique({
          where: { subdomain: projectSlug },
          select: { id: true },
        });
        if (project) return res.status(HttpStatus.OK).send('Allowed');
      }
    }
    
    // 404/403 tells Caddy: "Ignore this domain, do not give it an SSL cert."
    return res.status(HttpStatus.NOT_FOUND).send("Not Allowed");
  }
}
