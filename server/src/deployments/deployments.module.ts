import { Module } from '@nestjs/common';
import { DeploymentsService } from './deployments.service';
import { DeploymentsController } from './deployments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { AuthModule } from '../auth/auth.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    PrismaModule, 
    ProjectsModule, 
    AuthModule,
    BullModule.registerQueue({
      name: 'builds',
    }),
  ],
  providers: [DeploymentsService],
  controllers: [DeploymentsController],
})
export class DeploymentsModule {}
