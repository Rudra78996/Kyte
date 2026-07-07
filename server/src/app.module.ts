import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { ServeModule } from './serve/serve.module';
import { BullModule } from '@nestjs/bullmq';

import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          url: process.env.REDIS_URL || 'redis://localhost:6379',
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    ProjectsModule,
    DeploymentsModule,
    ServeModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
