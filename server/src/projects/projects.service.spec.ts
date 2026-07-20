import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { encrypt } from '../utils/crypto.util';
import { Prisma } from '@prisma/client';

describe('ProjectsService - Environment Variables', () => {
  let service: ProjectsService;
  let prisma: PrismaService;

  const mockPrisma = {
    project: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organizationMember: {
      findUnique: jest.fn(),
    },
    gitHubConnection: {
      findFirst: jest.fn(),
    },
    environmentVariable: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    customDomain: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (args) => {
      if (Array.isArray(args)) {
        return Promise.all(args);
      }
      return args(mockPrisma);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('project creation limits', () => {
    const dto = {
      name: 'Portfolio',
      repoUrl: 'https://github.com/example/portfolio',
      organizationId: 'org_1',
    };

    it('rejects a project without an organization', async () => {
      await expect(
        service.create('user_1', { ...dto, organizationId: '' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.project.create).not.toHaveBeenCalled();
    });

    it('rejects an organization the user does not belong to', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(service.create('user_1', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.project.create).not.toHaveBeenCalled();
    });

    it('enforces the four-project limit', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        role: 'ADMIN',
      });
      mockPrisma.project.count.mockResolvedValue(4);

      await expect(service.create('user_1', dto)).rejects.toThrow(
        'up to 4 projects',
      );
      expect(mockPrisma.project.create).not.toHaveBeenCalled();
    });

    it('does not let a MEMBER create projects', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        role: 'MEMBER',
      });

      await expect(service.create('user_1', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.project.create).not.toHaveBeenCalled();
    });

    it('creates a project when the organization and allowance are valid', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        role: 'OWNER',
      });
      mockPrisma.project.count.mockResolvedValue(3);
      mockPrisma.project.create.mockResolvedValue({ id: 'proj_1', ...dto });

      const project = await service.create('user_1', dto);

      expect(project.id).toBe('proj_1');
      expect(mockPrisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user_1',
            organizationId: 'org_1',
          }),
        }),
      );
    });
  });

  describe('webhook management', () => {
    it('requires GitHub repository administrator permission', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_1',
        repoUrl: 'https://github.com/example/portfolio',
        branch: 'main',
        webhookId: null,
      });
      const token = encrypt('github-token');
      mockPrisma.gitHubConnection.findFirst.mockResolvedValue({
        accessTokenEncrypted: token.encryptedValue,
        tokenIv: token.iv,
        tokenAuthTag: token.authTag,
      });
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ id: 123, permissions: { admin: false } }),
      } as Response);

      await expect(service.enableWebhook('user_1', 'proj_1')).rejects.toThrow(
        'administrator permission',
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(mockPrisma.project.update).not.toHaveBeenCalled();
    });

    it('stores the verified GitHub repository ID and real hook ID', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_1',
        repoUrl: 'https://github.com/example/portfolio',
        branch: 'main',
        webhookId: null,
      });
      const token = encrypt('github-token');
      mockPrisma.gitHubConnection.findFirst.mockResolvedValue({
        accessTokenEncrypted: token.encryptedValue,
        tokenIv: token.iv,
        tokenAuthTag: token.authTag,
      });
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 123, permissions: { admin: true } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 987 }),
        } as Response);

      await service.enableWebhook('user_1', 'proj_1');
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'proj_1' },
        data: { webhookId: '987', githubRepositoryId: '123' },
      });
    });

    it('returns webhook status without exposing the GitHub hook id', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_1',
        repoUrl: 'https://github.com/example/portfolio',
        branch: 'main',
        webhookId: '123',
      });

      const status = await service.getWebhookStatus('user_1', 'proj_1');

      expect(status).toEqual({
        enabled: true,
        provider: 'github',
        repository: 'https://github.com/example/portfolio',
        branch: 'main',
        limit: 1,
        canEnable: true,
      });
      expect(status).not.toHaveProperty('webhookId');
    });

    it('treats disabling an already-disabled webhook as successful', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_1',
        repoUrl: 'https://github.com/example/portfolio',
        branch: 'main',
        webhookId: null,
      });

      await expect(
        service.disableWebhook('user_1', 'proj_1'),
      ).resolves.toMatchObject({ enabled: false });
      expect(mockPrisma.gitHubConnection.findFirst).not.toHaveBeenCalled();
    });

    it('removes the GitHub hook before clearing the local status', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_1',
        repoUrl: 'git@github.com:example/portfolio.git',
        branch: 'main',
        webhookId: '123',
      });
      const token = encrypt('github-token');
      mockPrisma.gitHubConnection.findFirst.mockResolvedValue({
        accessTokenEncrypted: token.encryptedValue,
        tokenIv: token.iv,
        tokenAuthTag: token.authTag,
      });
      mockPrisma.project.update.mockResolvedValue({ webhookId: null });
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      const status = await service.disableWebhook('user_1', 'proj_1');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.github.com/repos/example/portfolio/hooks/123',
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: 'proj_1' },
        data: { webhookId: null, githubRepositoryId: null },
      });
      expect(status.enabled).toBe(false);
    });

    it('rejects enabling a second project before calling GitHub', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_2',
        userId: 'user_1',
        repoUrl: 'https://github.com/example/second-project',
        branch: 'main',
        webhookId: null,
      });
      mockPrisma.project.findFirst.mockResolvedValueOnce({ id: 'proj_1' });
      const fetchMock = jest.spyOn(global, 'fetch');

      await expect(
        service.enableWebhook('user_1', 'proj_2'),
      ).rejects.toMatchObject({
        response: {
          code: 'WEBHOOK_PROJECT_LIMIT_REACHED',
          limit: 1,
        },
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports that the webhook slot is unavailable on another project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_2',
        userId: 'user_1',
        repoUrl: 'https://github.com/example/second-project',
        branch: 'main',
        webhookId: null,
      });
      mockPrisma.project.findFirst.mockResolvedValueOnce({ id: 'proj_1' });

      await expect(
        service.getWebhookStatus('user_1', 'proj_2'),
      ).resolves.toMatchObject({
        enabled: false,
        canEnable: false,
        limit: 1,
      });
    });

    it('removes a newly-created GitHub hook if a concurrent enable wins', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_2',
        userId: 'user_1',
        repoUrl: 'https://github.com/example/second-project',
        branch: 'main',
        webhookId: null,
      });
      mockPrisma.project.findFirst.mockResolvedValueOnce(null);
      const token = encrypt('github-token');
      mockPrisma.gitHubConnection.findFirst.mockResolvedValue({
        accessTokenEncrypted: token.encryptedValue,
        tokenIv: token.iv,
        tokenAuthTag: token.authTag,
      });
      mockPrisma.project.update.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.12.0',
          meta: { target: ['userId'] },
        }),
      );
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 456, permissions: { admin: true } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 999 }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        } as Response);

      await expect(
        service.enableWebhook('user_1', 'proj_2'),
      ).rejects.toMatchObject({
        response: { code: 'WEBHOOK_PROJECT_LIMIT_REACHED' },
      });
      expect(fetchMock).toHaveBeenLastCalledWith(
        'https://api.github.com/repos/example/second-project/hooks/999',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('getEnvironmentVariables', () => {
    it('should mask environment variables without returning plaintext', async () => {
      const { encryptedValue, iv, authTag } = encrypt('my-secret-value');

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_1',
        environmentVariables: [{ key: 'API_KEY', encryptedValue, iv, authTag }],
      });

      const vars = await service.getEnvironmentVariables('user_1', 'proj_1');
      expect(vars).toHaveLength(1);
      expect(vars[0]).toEqual({ key: 'API_KEY', value: '', hasValue: true });
      expect(JSON.stringify(vars)).not.toContain('my-secret-value');
    });

    it('should throw NotFoundException if project is missing', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);
      await expect(
        service.getEnvironmentVariables('user_1', 'proj_1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return NotFoundException if user cannot access the project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_2', // different user
      });
      await expect(
        service.getEnvironmentVariables('user_1', 'proj_1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('central project access policy', () => {
    it('allows members to read and deploy but not manage', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_2',
        organizationId: 'org_1',
        organization: { members: [{ role: 'MEMBER' }] },
      });

      await expect(
        service.requireProjectAccess('user_1', 'proj_1', 'read'),
      ).resolves.toMatchObject({ id: 'proj_1' });
      await expect(
        service.requireProjectAccess('user_1', 'proj_1', 'deploy'),
      ).resolves.toMatchObject({ id: 'proj_1' });
      await expect(
        service.requireProjectAccess('user_1', 'proj_1', 'manage'),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows organization admins to manage projects', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_2',
        organizationId: 'org_1',
        organization: { members: [{ role: 'ADMIN' }] },
      });

      await expect(
        service.requireProjectAccess('user_1', 'proj_1', 'manage'),
      ).resolves.toMatchObject({ id: 'proj_1' });
    });

    it('hides another organization project across sensitive operations', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_other',
        userId: 'user_2',
        organizationId: 'org_other',
        organization: { members: [] },
      });

      const operations = [
        () => service.getMetrics('user_1', 'proj_other'),
        () => service.getEnvironmentVariables('user_1', 'proj_other'),
        () => service.getDomains('user_1', 'proj_other'),
        () =>
          service.upsertEnvironmentVariables('user_1', 'proj_other', [
            { key: 'SECRET', value: 'value' },
          ]),
        () => service.deleteDomain('user_1', 'proj_other', 'example.com'),
      ];
      for (const operation of operations) {
        await expect(operation()).rejects.toThrow(NotFoundException);
      }
      expect(mockPrisma.environmentVariable.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.customDomain.findMany).not.toHaveBeenCalled();
    });
  });

  describe('upsertEnvironmentVariables', () => {
    it('should securely encrypt and save new variables', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_1',
      });
      mockPrisma.environmentVariable.upsert.mockResolvedValue({ id: 'env_1' });
      mockPrisma.environmentVariable.findMany.mockResolvedValue([]);

      const newVars = [{ key: 'STRIPE_KEY', value: 'sk_test_123' }];
      const result = await service.upsertEnvironmentVariables(
        'user_1',
        'proj_1',
        newVars,
      );

      expect(result.success).toBe(true);

      const upsertCall = mockPrisma.environmentVariable.upsert.mock.calls[0][0];
      expect(upsertCall.where.projectId_key).toEqual({
        projectId: 'proj_1',
        key: 'STRIPE_KEY',
      });
      expect(upsertCall.create.key).toBe('STRIPE_KEY');
      expect(upsertCall.create.encryptedValue).toBeDefined();
      expect(upsertCall.create.encryptedValue).not.toBe('sk_test_123'); // Should be encrypted
      expect(upsertCall.create.iv).toBeDefined();
      expect(upsertCall.create.authTag).toBeDefined();
    });

    it('preserves an existing masked value when no replacement is entered', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_1',
      });
      mockPrisma.environmentVariable.findMany.mockResolvedValue([
        { key: 'API_KEY' },
      ]);

      const result = await service.upsertEnvironmentVariables(
        'user_1',
        'proj_1',
        [{ key: 'API_KEY', value: '' }],
      );

      expect(result).toEqual({ success: true, count: 0 });
      expect(mockPrisma.environmentVariable.upsert).not.toHaveBeenCalled();
    });
  });

  describe('custom domains', () => {
    it('normalizes a hostname before creating its verification record', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_1',
      });
      mockPrisma.customDomain.findUnique.mockResolvedValue(null);
      mockPrisma.customDomain.create.mockImplementation(async ({ data }) => ({
        id: 'domain_1',
        ...data,
        verifiedAt: null,
        createdAt: new Date(),
      }));

      const domain = await service.addDomain(
        'user_1',
        'proj_1',
        'HTTPS://WWW.Example.COM/',
      );

      expect(mockPrisma.customDomain.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            domainName: 'www.example.com',
            status: 'pending',
          }),
        }),
      );
      expect(domain.dnsRecords.verification.name).toBe('_kyte.www.example.com');
    });

    it('rejects hostnames with a port or path', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_1',
      });

      await expect(
        service.addDomain('user_1', 'proj_1', 'example.com:3000'),
      ).rejects.toThrow('valid hostname');
      expect(mockPrisma.customDomain.create).not.toHaveBeenCalled();
    });

    it('verifies local development hostnames without a public DNS lookup', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_1',
      });
      mockPrisma.customDomain.findUnique.mockResolvedValue({
        id: 'domain_1',
        projectId: 'proj_1',
        domainName: 'demo.localhost',
        verificationToken: 'kyte-verify=test',
        status: 'pending',
      });

      const result = await service.verifyDomain(
        'user_1',
        'proj_1',
        'demo.localhost',
      );

      expect(result.status).toBe('verified');
      expect(mockPrisma.customDomain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'domain_1' },
          data: expect.objectContaining({
            status: 'verified',
            verifiedAt: expect.any(Date),
          }),
        }),
      );
    });
  });
});
