import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { CurrentUser } from './auth/current-user.decorator';

const prisma = new PrismaClient();

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

  @Get('/notifications')
  @UseGuards(JwtAuthGuard)
  async getNotifications(@CurrentUser('id') userId: string) {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    return { notifications };
  }
}

