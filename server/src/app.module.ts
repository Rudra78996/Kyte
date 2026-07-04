import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { DeploymentsModule } from './deployments/deployments.module';

import { BullModule } from '@nestjs/bullmq';

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
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
