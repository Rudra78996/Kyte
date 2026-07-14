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
});
