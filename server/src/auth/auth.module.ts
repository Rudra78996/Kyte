import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Redis from 'ioredis';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { GITHUB_OAUTH_REDIS } from './auth.service';
import { requireAuthenticatedRedisUrl } from '../common/runtime-config';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    {
      provide: GITHUB_OAUTH_REDIS,
      useFactory: () =>
        new Redis(requireAuthenticatedRedisUrl(), {
          maxRetriesPerRequest: 2,
        }),
    },
  ],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
