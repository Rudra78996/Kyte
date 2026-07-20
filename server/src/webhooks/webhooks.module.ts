import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import Redis from 'ioredis';
import { WEBHOOK_REDIS } from './webhooks.service';
import { requireAuthenticatedRedisUrl } from '../common/runtime-config';

@Module({
  imports: [
    PrismaModule,
    DeploymentsModule,
  ],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    {
      provide: WEBHOOK_REDIS,
      useFactory: () =>
        new Redis(requireAuthenticatedRedisUrl(), {
          maxRetriesPerRequest: 2,
        }),
    },
  ],
})
export class WebhooksModule {}
