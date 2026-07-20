import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { CaddyController } from './caddy.controller';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { ServeModule } from './serve/serve.module';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { WebhooksModule } from './webhooks/webhooks.module';
import { OrganizationsModule } from './organizations/organizations.module';

import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { requireAuthenticatedRedisUrl } from './common/runtime-config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [{
          ttl: 60000,
          limit: 100,
        }],
        storage: new ThrottlerStorageRedisService(
          new Redis(requireAuthenticatedRedisUrl())
        ),
      }),
    }),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          url: requireAuthenticatedRedisUrl(),
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
    DeploymentsModule,
    ServeModule,
    WebhooksModule,
  ],
  controllers: [AppController, CaddyController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
