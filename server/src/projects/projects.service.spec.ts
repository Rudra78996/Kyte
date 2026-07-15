import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { encrypt } from '../utils/crypto.util';

describe('ProjectsService - Environment Variables', () => {
  let service: ProjectsService;
  let prisma: PrismaService;

  const mockPrisma = {
    project: {
      findUnique: jest.fn(),
    },
    environmentVariable: {
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

  describe('getEnvironmentVariables', () => {
    it('should return decrypted environment variables', async () => {
      const { encryptedValue, iv } = encrypt('my-secret-value');
      
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_1',
        environmentVariables: [
          { key: 'API_KEY', encryptedValue, iv }
        ]
      });

      const vars = await service.getEnvironmentVariables('user_1', 'proj_1');
      expect(vars).toHaveLength(1);
      expect(vars[0]).toEqual({ key: 'API_KEY', value: 'my-secret-value' });
    });

    it('should throw NotFoundException if project is missing', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);
      await expect(service.getEnvironmentVariables('user_1', 'proj_1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_2', // different user
      });
      await expect(service.getEnvironmentVariables('user_1', 'proj_1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('upsertEnvironmentVariables', () => {
    it('should securely encrypt and save new variables', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'proj_1',
        userId: 'user_1',
      });
      mockPrisma.environmentVariable.upsert.mockResolvedValue({ id: 'env_1' });

      const newVars = [{ key: 'STRIPE_KEY', value: 'sk_test_123' }];
      const result = await service.upsertEnvironmentVariables('user_1', 'proj_1', newVars);

      expect(result.success).toBe(true);
      
      const upsertCall = mockPrisma.environmentVariable.upsert.mock.calls[0][0];
      expect(upsertCall.where.projectId_key).toEqual({ projectId: 'proj_1', key: 'STRIPE_KEY' });
      expect(upsertCall.create.key).toBe('STRIPE_KEY');
      expect(upsertCall.create.encryptedValue).toBeDefined();
      expect(upsertCall.create.encryptedValue).not.toBe('sk_test_123'); // Should be encrypted
      expect(upsertCall.create.iv).toBeDefined();
    });
  });

  describe('custom domains', () => {
    it('normalizes a hostname before creating its verification record', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj_1', userId: 'user_1' });
      mockPrisma.customDomain.findUnique.mockResolvedValue(null);
      mockPrisma.customDomain.create.mockImplementation(async ({ data }) => ({
        id: 'domain_1',
        ...data,
        verifiedAt: null,
        createdAt: new Date(),
      }));

      const domain = await service.addDomain('user_1', 'proj_1', 'HTTPS://WWW.Example.COM/');

      expect(mockPrisma.customDomain.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ domainName: 'www.example.com', status: 'pending' }),
      }));
      expect(domain.dnsRecords.verification.name).toBe('_kyte.www.example.com');
    });

    it('rejects hostnames with a port or path', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj_1', userId: 'user_1' });

      await expect(service.addDomain('user_1', 'proj_1', 'example.com:3000')).rejects.toThrow('valid hostname');
      expect(mockPrisma.customDomain.create).not.toHaveBeenCalled();
    });

    it('verifies local development hostnames without a public DNS lookup', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj_1', userId: 'user_1' });
      mockPrisma.customDomain.findUnique.mockResolvedValue({
        id: 'domain_1',
        projectId: 'proj_1',
        domainName: 'demo.localhost',
        verificationToken: 'kyte-verify=test',
        status: 'pending',
      });

      const result = await service.verifyDomain('user_1', 'proj_1', 'demo.localhost');

      expect(result.status).toBe('verified');
      expect(mockPrisma.customDomain.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'domain_1' },
        data: expect.objectContaining({ status: 'verified', verifiedAt: expect.any(Date) }),
      }));
    });
  });
});
