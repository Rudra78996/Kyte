import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import type Redis from 'ioredis';
import {
  DeploymentsService,
  MAX_WEBHOOK_DEPLOYMENTS_PER_24_HOURS,
  WebhookDeploymentQuotaExceededError,
} from '../deployments/deployments.service';
import { PrismaService } from '../prisma/prisma.service';

export const WEBHOOK_REDIS = Symbol('WEBHOOK_REDIS');
const DELIVERY_TTL_SECONDS = 24 * 60 * 60;
const QUOTA_NOTICE_TTL_SECONDS = 24 * 60 * 60;

interface GitHubPushPayload {
  ref?: unknown;
  after?: unknown;
  deleted?: unknown;
  head_commit?: { message?: unknown } | null;
  repository?: {
    id?: unknown;
    full_name?: unknown;
  };
}

@Injectable()
export class WebhooksService implements OnModuleDestroy {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deployments: DeploymentsService,
    @Inject(WEBHOOK_REDIS) private readonly redis: Redis,
  ) {}

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async handlePushEvent(deliveryId: string, payload: unknown) {
    const firstAttempt = await this.redis.set(
      `github:webhook-delivery:${deliveryId}`,
      '1',
      'EX',
      DELIVERY_TTL_SECONDS,
      'NX',
    );
    if (firstAttempt !== 'OK') {
      this.logger.log('Ignoring duplicate GitHub delivery');
      return;
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('Malformed GitHub push payload');
    }
    const push = payload as GitHubPushPayload;
    const repositoryId = push.repository?.id;
    const repositoryName = push.repository?.full_name;
    const ref = push.ref;
    const commitSha = push.after;
    if (
      (typeof repositoryId !== 'number' &&
        !(
          typeof repositoryId === 'string' &&
          /^[1-9][0-9]{0,19}$/.test(repositoryId)
        )) ||
      (typeof repositoryId === 'number' &&
        (!Number.isSafeInteger(repositoryId) || repositoryId <= 0)) ||
      typeof repositoryName !== 'string' ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repositoryName) ||
      typeof ref !== 'string' ||
      ref.length > 220
    ) {
      throw new BadRequestException('Malformed GitHub push payload');
    }
    if (!ref.startsWith('refs/heads/')) {
      this.logger.log('Ignoring non-branch GitHub ref');
      return;
    }
    const branch = ref.slice('refs/heads/'.length);
    if (
      push.deleted === true ||
      typeof commitSha !== 'string' ||
      !/^[a-fA-F0-9]{40}$/.test(commitSha) ||
      commitSha === '0'.repeat(40)
    ) {
      this.logger.log('Ignoring branch deletion or invalid commit');
      return;
    }
    const commitMessage =
      typeof push.head_commit?.message === 'string'
        ? push.head_commit.message.slice(0, 500)
        : undefined;

    const projects = await this.prisma.project.findMany({
      where: {
        githubRepositoryId: String(repositoryId),
        webhookId: { not: null },
        branch,
      },
    });
    for (const project of projects) {
      try {
        await this.deployments.createFromWebhook(
          project,
          commitSha.toLowerCase(),
          commitMessage,
        );
      } catch (error) {
        if (error instanceof WebhookDeploymentQuotaExceededError) {
          this.logger.warn(
            `Skipping webhook deployment for project ${project.id}: 24-hour webhook build quota reached`,
          );
          try {
            const shouldNotify = await this.redis.set(
              `github:webhook-quota-notice:${project.userId}`,
              '1',
              'EX',
              QUOTA_NOTICE_TTL_SECONDS,
              'NX',
            );
            if (shouldNotify === 'OK') {
              await this.prisma.notification.create({
                data: {
                  userId: project.userId,
                  title: 'Webhook build limit reached',
                  message:
                    `Automatic deployments are limited to ${MAX_WEBHOOK_DEPLOYMENTS_PER_24_HOURS} builds per 24 hours. ` +
                    'Manual deployments remain available.',
                  type: 'WARNING',
                },
              });
            }
          } catch {
            this.logger.error(
              `Failed to record webhook quota notification for user ${project.userId}`,
            );
          }
          continue;
        }
        if (
          error instanceof BadRequestException &&
          error.message.includes('Too many active deployments')
        ) {
          this.logger.warn(
            `Skipping webhook deployment for project ${project.id}: active deployment limit reached`,
          );
          continue;
        }
        throw error;
      }
    }
  }
}
