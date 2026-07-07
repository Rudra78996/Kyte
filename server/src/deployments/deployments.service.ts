import { Injectable, ForbiddenException, NotFoundException, BadRequestException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateDeploymentDto } from './dto/deployment.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class DeploymentsService implements OnModuleInit {
  private readonly logger = new Logger(DeploymentsService.name);

  constructor(
    private prisma: PrismaService,
    private projectsService: ProjectsService,
    @InjectQueue('builds') private queue: Queue,
  ) {}

  onModuleInit() {
    // Reconcile stuck jobs every 5 minutes
    setInterval(async () => {
      try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const stuckDeployments = await this.prisma.deployment.findMany({
          where: {
            status: { in: ['QUEUED', 'BUILDING', 'UPLOADING'] },
            deployedAt: { lt: fifteenMinutesAgo },
          },
        });

        if (stuckDeployments.length > 0) {
          this.logger.warn(`Found ${stuckDeployments.length} stuck deployments. Marking as FAILED.`);
          await this.prisma.deployment.updateMany({
            where: {
              id: { in: stuckDeployments.map(d => d.id) }
            },
            data: { status: 'FAILED' }
          });
        }
      } catch (err) {
        this.logger.error('Failed to reconcile stuck jobs', err);
      }
    }, 5 * 60 * 1000);
  }

  async create(userId: string, projectId: string, dto: CreateDeploymentDto) {
    // Verify project ownership
    await this.projectsService.findOne(userId, projectId);

    // Idempotency: check if deployment with same commit already exists and is pending
    const existingPending = await this.prisma.deployment.findFirst({
      where: {
        projectId,
        commitSha: dto.commitSha,
        status: 'QUEUED',
      },
    });

    if (existingPending) {
      return existingPending;
    }

    // Limit active deployments per project to prevent DDoS / queue starvation
    const activeDeploymentsCount = await this.prisma.deployment.count({
      where: {
        projectId,
        status: { in: ['QUEUED', 'BUILDING', 'UPLOADING'] },
      }
    });

    if (activeDeploymentsCount >= 2) {
      throw new BadRequestException('Too many active deployments for this project. Please wait for them to finish.');
    }

    if (existingPending) {
      return existingPending;
    }

    // Create deployment record
    const deployment = await this.prisma.deployment.create({
      data: {
        projectId,
        repoUrl: dto.repoUrl,
        branch: dto.branch,
        commitSha: dto.commitSha,
        commitMessage: dto.commitMessage,
        deployedBy: userId,
        status: 'QUEUED',
        triggerSource: (dto.trigger || 'MANUAL').toUpperCase() as any,
        s3Prefix: `${projectId}/${Date.now()}`,
      },
    });

    // Enqueue job in Phase 3
    await this.queue.add('deploy', {
      deploymentId: deployment.id,
      repoUrl: deployment.repoUrl,
      branch: deployment.branch,
      commitSha: deployment.commitSha,
    }, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: { age: 24 * 3600, count: 100 },
    });

    return deployment;
  }

  async findAll(userId: string, projectId: string, skip = 0, take = 20) {
    // Verify project ownership
    await this.projectsService.findOne(userId, projectId);

    const [deployments, total] = await Promise.all([
      this.prisma.deployment.findMany({
        where: { projectId },
        skip,
        take,
        orderBy: { deployedAt: 'desc' },
      }),
      this.prisma.deployment.count({ where: { projectId } }),
    ]);

    return { deployments, total, skip, take };
  }

  async findOne(userId: string, projectId: string, deploymentId: string) {
    // Verify project ownership
    await this.projectsService.findOne(userId, projectId);

    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        logs: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    if (deployment.projectId !== projectId) {
      throw new ForbiddenException(
        'Deployment does not belong to this project',
      );
    }

    return deployment;
  }

  async rollback(userId: string, projectId: string, deploymentId: string) {
    // Verify project ownership
    await this.projectsService.findOne(userId, projectId);

    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    if (deployment.projectId !== projectId) {
      throw new ForbiddenException(
        'Deployment does not belong to this project',
      );
    }

    if (deployment.status !== 'SUCCESS') {
      throw new NotFoundException('Cannot rollback non-successful deployment');
    }

    // Get previous successful deployment
    const previousDeploy = await this.prisma.deployment.findFirst({
      where: {
        projectId,
        status: 'SUCCESS',
        deployedAt: { lt: deployment.deployedAt },
      },
      orderBy: { deployedAt: 'desc' },
    });

    if (!previousDeploy) {
      throw new NotFoundException('No previous successful deployment found');
    }

    // Create rollback deployment
    const rollbackDeploy = await this.prisma.deployment.create({
      data: {
        projectId,
        repoUrl: previousDeploy.repoUrl,
        branch: previousDeploy.branch,
        commitSha: previousDeploy.commitSha,
        commitMessage: `Rollback to ${previousDeploy.commitSha.slice(0, 7)}`,
        deployedBy: userId,
        status: 'QUEUED',
        triggerSource: 'MANUAL',
        s3Prefix: `${projectId}/${Date.now()}`,
      },
    });

    // Enqueue rollback job in Phase 3
    await this.queue.add('deploy', {
      deploymentId: rollbackDeploy.id,
      repoUrl: rollbackDeploy.repoUrl,
      branch: rollbackDeploy.branch,
      commitSha: rollbackDeploy.commitSha,
    }, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: { age: 24 * 3600, count: 100 },
    });

    return rollbackDeploy;
  }

  async streamLogs(userId: string, projectId: string, id: string): Promise<Observable<MessageEvent>> {
    await this.projectsService.findOne(userId, projectId);
    
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
    });

    if (!deployment || deployment.projectId !== projectId) {
      throw new ForbiddenException('Deployment does not belong to this project');
    }

    return new Observable((observer) => {
      // Send historical logs first
      this.prisma.deploymentLogChunk.findMany({
        where: { deploymentId: id },
        orderBy: { sequence: 'asc' }
      }).then(logs => {
        logs.forEach(log => {
          observer.next({ data: { text: log.content, stream: log.stream } });
        });
      }).catch(err => {
        console.error('Failed to fetch historical logs', err);
      });

      const channel = `deploy:${id}`;
      const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      
      redisClient.subscribe(channel, (err) => {
        if (err) observer.error(err);
      });

      redisClient.on('message', (ch, message) => {
        if (ch === channel) {
          try {
            observer.next({ data: JSON.parse(message) });
          } catch (e) {
            observer.next({ data: { text: message, stream: 'STDOUT' } });
          }
        }
      });

      // Cleanup when client disconnects
      return () => {
        redisClient.unsubscribe(channel);
        redisClient.quit();
      };
    });
  }
}
