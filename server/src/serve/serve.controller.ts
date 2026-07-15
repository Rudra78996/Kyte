import { Controller, Get, Param, Res, Req } from '@nestjs/common';
import { ServeService } from './serve.service';
import type { Response, Request } from 'express';

@Controller('serve')
export class ServeController {
  constructor(private readonly serveService: ServeService) {}

  @Get('host/:host')
  async serveHostRoot(@Param('host') host: string, @Req() req: Request, @Res() res: Response) {
    return this.serveService.serveHostname(host, '', res, req);
  }

  @Get('host/:host/*')
  async serveHostPath(@Param('host') host: string, @Req() req: Request, @Res() res: Response) {
    const prefix = `/serve/host/${host}/`;
    const path = req.path.replace(prefix, '');
    return this.serveService.serveHostname(host, path, res, req);
  }

  @Get('domain/:domain')
  async serveDomainRoot(@Param('domain') domain: string, @Req() req: Request, @Res() res: Response) {
    return this.serveService.serveCustomDomain(domain, '', res, req);
  }

  @Get('domain/:domain/*')
  async serveDomainPath(@Param('domain') domain: string, @Req() req: Request, @Res() res: Response) {
    const prefix = `/serve/domain/${domain}/`;
    const path = req.path.replace(prefix, '');
    return this.serveService.serveCustomDomain(domain, path, res, req);
  }

  @Get(':slug')
  async serveRoot(@Param('slug') slug: string, @Req() req: Request, @Res() res: Response) {
    return this.serveService.serveFile(slug, '', res, req);
  }

  @Get(':slug/*')
  async servePath(@Param('slug') slug: string, @Req() req: Request, @Res() res: Response) {
    const prefix = `/serve/${slug}/`;
    const path = req.path.replace(prefix, '');
    return this.serveService.serveFile(slug, path, res, req);
  }
}
