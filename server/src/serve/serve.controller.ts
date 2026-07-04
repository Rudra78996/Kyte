import { Controller, Get, Param, Res, Req } from '@nestjs/common';
import { ServeService } from './serve.service';
import type { Response, Request } from 'express';

@Controller('serve')
export class ServeController {
  constructor(private readonly serveService: ServeService) {}

  @Get(':slug')
  async serveRoot(@Param('slug') slug: string, @Res() res: Response) {
    return this.serveService.serveFile(slug, '', res);
  }

  @Get(':slug/*')
  async servePath(@Param('slug') slug: string, @Req() req: Request, @Res() res: Response) {
    // extract path after /serve/:slug/
    const prefix = `/serve/${slug}/`;
    const path = req.path.replace(prefix, '');
    return this.serveService.serveFile(slug, path, res);
  }
}
