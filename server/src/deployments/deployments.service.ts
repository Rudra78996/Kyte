import {
  BadRequestException,
  Injectable,
  Logger,
  MessageEvent,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DeploymentTrigger, Prisma, Project } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateDeploymentDto } from './dto/deployment.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Observable } from 'rxjs';
import Redis from 'ioredis';
import { randomBytes } from 'node:crypto';
import { requireAuthenticatedRedisUrl } from '../common/runtime-config';

export const MAX_ACTIVE_DEPLOYMENTS = 2;
export const MAX_WEBHOOK_DEPLOYMENTS_PER_24_HOURS = 30;
const PLATFORM_SETTINGS_ID = 'platform';
const WEBHOOK_QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;
const QUEUE_JOB_OPTIONS = {
  attempts: 2,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: true,
  removeOnFail: { age: 24 * 3600, count: 100 },
};

export class WebhookDeploymentQuotaExceededError extends Error {
  constructor() {
    super(
      `Webhook deployment limit reached: ${MAX_WEBHOOK_DEPLOYMENTS_PER_24_HOURS} builds per 24 hours`,
    );
    this.name = 'WebhookDeploymentQuotaExceededError';
  }
}

function randomSuffix() {
  return randomBytes(8).toString('hex');
}

@Injectable()
export class DeploymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeploymentsService.name);
  private reconcileInterval: NodeJS.Timeout;
  private redisClient: Redis;

  constructor(
    private prisma: PrismaService,
    private projectsService: ProjectsService,
    @InjectQueue('builds') private queue: Queue,
  ) {
    this.redisClient = new Redis(requireAuthenticatedRedisUrl());
  }

  onModuleInit() {
    this.reconcileInterval = setInterval(
      async () => {
        // Leader election lock using redis SETNX
        const lockKey = 'deployments:reconciler:lock';
        const lockAcquired = await this.redisClient.set(
          lockKey,
          'locked',
          'PX',
          10000,
          'NX',
        );
        if (!lockAcquired) return;

        try {
          const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
          const stuckDeployments = await this.prisma.deployment.findMany({
            where: {
              status: { in: ['QUEUED', 'BUILDING', 'UPLOADING'] },
              updatedAt: { lt: fifteenMinutesAgo },
            },
          });

          if (stuckDeployments.length > 0) {
            this.logger.warn(
              `Found ${stuckDeployments.length} stuck deployments. Marking as FAILED.`,
            );
            for (const dep of stuckDeployments) {
              await this.prisma.deployment.update({
                where: { id: dep.id },
                data: { status: 'FAILED' },
              });
              try {
                const job = await this.queue.getJob(dep.id);
                if (job) await job.remove();
              } catch (e) {
                this.logger.error(
                  `Failed to remove job for deployment ${dep.id}`,
                );
              }
            }
          }
        } catch (err) {
          this.logger.error('Failed to reconcile stuck jobs', err);
        }
      },
      5 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.reconcileInterval) {
      clearInterval(this.reconcileInterval);
    }
    this.redisClient.quit();
  }

  async create(userId: string, projectId: string, dto: CreateDeploymentDto) {
    const project = await this.projectsService.requireProjectAccess(
      userId,
      projectId,
      'deploy',
    );
    return this.createWithinLimit({
      project,
      commitSha: dto.commitSha || 'HEAD',
      commitMessage: dto.commitMessage,
      deployedBy: userId,
      triggerSource: 'MANUAL',
      deduplicate: true,
    });
  }

  async createFromWebhook(
    project: Project,
    commitSha: string,
    commitMessage?: string,
  ) {
    return this.createWithinLimit({
      project,
      commitSha,
      commitMessage,
      deployedBy: project.userId,
      triggerSource: 'WEBHOOK',
      deduplicate: true,
    });
  }

  private async createWithinLimit(input: {
    project: Project;
    commitSha: string;
    commitMessage?: string;
    deployedBy: string;
    triggerSource: DeploymentTrigger;
    deduplicate: boolean;
  }) {
    await this.prisma.$executeRaw`
      INSERT INTO "PlatformSettings" ("id", "deploymentsPaused", "defaultProjectLimit", "updatedAt")
      VALUES (${PLATFORM_SETTINGS_ID}, false, 4, NOW())
      ON CONFLICT ("id") DO NOTHING
    `;
    const [settings] = await this.prisma.$queryRaw<
      { deploymentsPaused: boolean }[]
    >`
      SELECT "deploymentsPaused"
      FROM "PlatformSettings"
      WHERE "id" = ${PLATFORM_SETTINGS_ID}
      LIMIT 1
    `;
    if (settings.deploymentsPaused) {
      throw new BadRequestException(
        'New deployments are temporarily paused by the platform administrator.',
      );
    }

    let result:
      | {
          deployment: Awaited<ReturnType<typeof this.prisma.deployment.create>>;
          created: boolean;
        }
      | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await this.prisma.$transaction(
          async (tx) => {
            if (input.deduplicate) {
              const existing = await tx.deployment.findFirst({
                where: {
                  projectId: input.project.id,
                  commitSha: input.commitSha,
                  triggerSource: input.triggerSource,
                  status: { in: ['QUEUED', 'BUILDING', 'UPLOADING'] },
                },
              });
              if (existing) {
                return { deployment: existing, created: false };
              }
            }
            if (input.triggerSource === 'WEBHOOK') {
              const quotaWindowStart = new Date(
                Date.now() - WEBHOOK_QUOTA_WINDOW_MS,
              );
              const webhookDeployments = await tx.deployment.count({
                where: {
                  deployedBy: input.project.userId,
                  triggerSource: 'WEBHOOK',
                  deployedAt: { gte: quotaWindowStart },
                },
              });
              if (webhookDeployments >= MAX_WEBHOOK_DEPLOYMENTS_PER_24_HOURS) {
                throw new WebhookDeploymentQuotaExceededError();
              }
            }
            const active = await tx.deployment.count({
              where: {
                projectId: input.project.id,
                status: { in: ['QUEUED', 'BUILDING', 'UPLOADING'] },
              },
            });
            if (active >= MAX_ACTIVE_DEPLOYMENTS) {
              throw new BadRequestException(
                'Too many active deployments for this project. Please wait for them to finish.',
              );
            }
            const deployment = await tx.deployment.create({
              data: {
                projectId: input.project.id,
                repoUrl: input.project.repoUrl,
                branch: input.project.branch || 'main',
                commitSha: input.commitSha,
                commitMessage: input.commitMessage,
                deployedBy: input.deployedBy,
                status: 'QUEUED',
                triggerSource: input.triggerSource,
                s3Prefix: `${input.project.id}/${Date.now()}-${randomSuffix()}`,
              },
            });
            return { deployment, created: true };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }
    if (!result) {
      throw new BadRequestException('Could not create deployment');
    }
    if (result.created) {
      await this.queue.add(
        'deploy',
        { deploymentId: result.deployment.id },
        {
          jobId: result.deployment.id,
          ...QUEUE_JOB_OPTIONS,
        },
      );
    }
    return result.deployment;
  }

  async findAll(userId: string, projectId: string, skip = 0, take = 20) {
    await this.projectsService.requireProjectAccess(userId, projectId, 'read');

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
    await this.projectsService.requireProjectAccess(userId, projectId, 'read');

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
      throw new NotFoundException('Deployment not found');
    }

    return deployment;
  }

  async rollback(userId: string, projectId: string, deploymentId: string) {
    const project = await this.projectsService.requireProjectAccess(
      userId,
      projectId,
      'deploy',
    );

    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    if (deployment.projectId !== projectId) {
      throw new NotFoundException('Deployment not found');
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

    return this.createWithinLimit({
      project,
      commitSha: previousDeploy.commitSha,
      commitMessage: `Rollback to ${previousDeploy.commitSha.slice(0, 7)}`,
      deployedBy: userId,
      triggerSource: 'MANUAL',
      deduplicate: false,
    });
  }

  async streamLogs(
    userId: string,
    projectId: string,
    id: string,
  ): Promise<Observable<MessageEvent>> {
    await this.projectsService.requireProjectAccess(userId, projectId, 'read');

    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
    });

    if (!deployment || deployment.projectId !== projectId) {
      throw new NotFoundException('Deployment not found');
    }

    return new Observable((observer) => {
      // Send historical logs first
      this.prisma.deploymentLogChunk
        .findMany({
          where: { deploymentId: id },
          orderBy: { sequence: 'asc' },
        })
        .then((logs) => {
          logs.forEach((log) => {
            observer.next({ data: { text: log.content, stream: log.stream } });
          });
        })
        .catch((err) => {
          console.error('Failed to fetch historical logs', err);
        });

      const channel = `deploy:${id}`;
      const redisClient = new Redis(requireAuthenticatedRedisUrl());

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
