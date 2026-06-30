import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root(): { service: string; message: string } {
    return {
      service: 'api',
      message: 'Deployly NestJS server is running',
    };
  }

  @Get('/health')
  health(): { service: string; status: string } {
    return {
      service: 'api',
      status: 'ok',
    };
  }
}

