import { BadRequestException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhookDeploymentQuotaExceededError } from '../deployments/deployments.service';

describe('WebhooksService', () => {
  const project = {
    id: 'proj_1',
    userId: 'user_1',
    repoUrl: 'https://github.com/example/portfolio',
    branch: 'main',
    githubRepositoryId: '123456',
    webhookId: '987',
  };
  const payload = {
    repository: { id: 123456, full_name: 'example/portfolio' },
    ref: 'refs/heads/main',
    after: 'a'.repeat(40),
    head_commit: { message: 'Update portfolio' },
  };
  const prisma = {
    project: { findMany: jest.fn() },
  };
  const deployments = {
    createFromWebhook: jest.fn(),
  };
  const redis = {
    set: jest.fn(),
    quit: jest.fn(),
  };
  let service: WebhooksService;

  beforeEach(() => {
    jest.clearAllMocks();
    redis.set.mockResolvedValue('OK');
    prisma.project.findMany.mockResolvedValue([project]);
    deployments.createFromWebhook.mockResolvedValue({ id: 'deploy_1' });
    service = new WebhooksService(
      prisma as never,
      deployments as never,
      redis as never,
    );
  });

  it('deduplicates delivery IDs in Redis for 24 hours', async () => {
    await service.handlePushEvent(
      '11111111-1111-4111-8111-111111111111',
      payload,
    );

    expect(redis.set).toHaveBeenCalledWith(
      'github:webhook-delivery:11111111-1111-4111-8111-111111111111',
      '1',
      'EX',
      86_400,
      'NX',
    );
    expect(deployments.createFromWebhook).toHaveBeenCalledWith(
      project,
      'a'.repeat(40),
      'Update portfolio',
    );
  });

  it('ignores a duplicate delivery before querying projects', async () => {
    redis.set.mockResolvedValue(null);
    await service.handlePushEvent(
      '11111111-1111-4111-8111-111111111111',
      payload,
    );
    expect(prisma.project.findMany).not.toHaveBeenCalled();
    expect(deployments.createFromWebhook).not.toHaveBeenCalled();
  });

  it('matches only the stored GitHub repository ID and branch', async () => {
    await service.handlePushEvent(
      '11111111-1111-4111-8111-111111111111',
      payload,
    );
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: {
        githubRepositoryId: '123456',
        webhookId: { not: null },
        branch: 'main',
      },
    });
  });

  it('rejects malformed payloads and ignores tags or branch deletions', async () => {
    await expect(
      service.handlePushEvent('11111111-1111-4111-8111-111111111111', {
        repository: { id: 'not-an-id' },
      }),
    ).rejects.toThrow(BadRequestException);

    redis.set.mockResolvedValue('OK');
    await service.handlePushEvent('22222222-2222-4222-8222-222222222222', {
      ...payload,
      ref: 'refs/tags/v1.0',
    });
    await service.handlePushEvent('33333333-3333-4333-8333-333333333333', {
      ...payload,
      deleted: true,
      after: '0'.repeat(40),
    });
    expect(deployments.createFromWebhook).not.toHaveBeenCalled();
  });

  it('acknowledges quota-limited pushes without creating a deployment', async () => {
    deployments.createFromWebhook.mockRejectedValue(
      new WebhookDeploymentQuotaExceededError(),
    );
    redis.set.mockResolvedValueOnce('OK');

    await expect(
      service.handlePushEvent('44444444-4444-4444-8444-444444444444', payload),
    ).resolves.toBeUndefined();

    expect(deployments.createFromWebhook).toHaveBeenCalledTimes(1);
  });
});
