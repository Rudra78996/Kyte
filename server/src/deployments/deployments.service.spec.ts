import { BadRequestException } from '@nestjs/common';
import {
  DeploymentsService,
  MAX_WEBHOOK_DEPLOYMENTS_PER_24_HOURS,
  WebhookDeploymentQuotaExceededError,
} from './deployments.service';

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    quit: jest.fn(),
  })),
);

describe('DeploymentsService security', () => {
  const project = {
    id: 'proj_1',
    userId: 'user_1',
    repoUrl: 'https://github.com/example/trusted',
    branch: 'main',
  };
  const prisma = {
    deployment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const projects = {
    requireProjectAccess: jest.fn(),
  };
  const queue = { add: jest.fn() };
  let service: DeploymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    projects.requireProjectAccess.mockResolvedValue(project);
    prisma.deployment.findFirst.mockResolvedValue(null);
    prisma.deployment.count.mockResolvedValue(0);
    prisma.deployment.create.mockImplementation(async ({ data }) => ({
      id: 'deploy_1',
      ...data,
    }));
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma),
    );
    service = new DeploymentsService(
      prisma as never,
      projects as never,
      queue as never,
    );
  });

  it('uses the trusted project repository, branch, and MANUAL trigger', async () => {
    await service.create('user_1', 'proj_1', {
      commitSha: 'HEAD',
      ...({
        repoUrl: 'https://github.com/attacker/repo',
        branch: 'attacker',
        trigger: 'webhook',
      } as object),
    });

    expect(projects.requireProjectAccess).toHaveBeenCalledWith(
      'user_1',
      'proj_1',
      'deploy',
    );
    expect(prisma.deployment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        repoUrl: project.repoUrl,
        branch: project.branch,
        triggerSource: 'MANUAL',
      }),
    });
  });

  it('enforces the same active deployment limit', async () => {
    prisma.deployment.count.mockResolvedValue(2);
    await expect(
      service.create('user_1', 'proj_1', { commitSha: 'HEAD' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.deployment.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('creates webhook deployments through the shared limiter', async () => {
    await service.createFromWebhook(
      project as never,
      'a'.repeat(40),
      'Push commit',
    );
    expect(prisma.deployment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        repoUrl: project.repoUrl,
        branch: project.branch,
        commitSha: 'a'.repeat(40),
        triggerSource: 'WEBHOOK',
      }),
    });
  });

  it('limits webhook deployments to 30 per owner in a rolling 24 hours', async () => {
    prisma.deployment.count.mockResolvedValueOnce(
      MAX_WEBHOOK_DEPLOYMENTS_PER_24_HOURS,
    );

    await expect(
      service.createFromWebhook(
        project as never,
        'b'.repeat(40),
        'Automated commit',
      ),
    ).rejects.toBeInstanceOf(WebhookDeploymentQuotaExceededError);
    expect(prisma.deployment.count).toHaveBeenCalledWith({
      where: {
        deployedBy: project.userId,
        triggerSource: 'WEBHOOK',
        deployedAt: { gte: expect.any(Date) },
      },
    });
    expect(prisma.deployment.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('does not apply the webhook quota to manual deployments', async () => {
    prisma.deployment.count.mockResolvedValue(0);

    await expect(
      service.create('user_1', 'proj_1', { commitSha: 'HEAD' }),
    ).resolves.toMatchObject({ triggerSource: 'MANUAL' });
    expect(prisma.deployment.count).toHaveBeenCalledTimes(1);
    expect(prisma.deployment.count).toHaveBeenCalledWith({
      where: {
        projectId: project.id,
        status: { in: ['QUEUED', 'BUILDING', 'UPLOADING'] },
      },
    });
  });

  it('does not enqueue a duplicate active deployment twice', async () => {
    prisma.deployment.findFirst.mockResolvedValue({
      id: 'deploy_existing',
      projectId: project.id,
      commitSha: 'HEAD',
      triggerSource: 'MANUAL',
      status: 'QUEUED',
    });

    const deployment = await service.create('user_1', 'proj_1', {
      commitSha: 'HEAD',
    });

    expect(deployment.id).toBe('deploy_existing');
    expect(prisma.deployment.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('returns 404 when a deployment belongs to a different project', async () => {
    prisma.deployment.findUnique.mockResolvedValue({
      id: 'deploy_other',
      projectId: 'proj_other',
      logs: [],
    });

    await expect(
      service.findOne('user_1', 'proj_1', 'deploy_other'),
    ).rejects.toThrow('Deployment not found');
  });
});
