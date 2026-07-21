import { Worker } from 'bullmq';

jest.mock('node:http', () => ({
  createServer: jest.fn().mockReturnValue({
    listen: jest.fn(),
  }),
}));
import { decrypt } from '../utils/crypto.util';
import {
  cleanupIsolatedBuild,
  createIsolatedBuild,
  waitForIsolatedBuild,
} from './build-exchange';

jest.mock('bullmq', () => {
  return {
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
    })),
  };
});
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    publish: jest.fn(),
  }));
});
jest.mock('../utils/crypto.util', () => ({
  assertEncryptionConfigured: jest.fn(),
  decrypt: jest.fn(),
}));
jest.mock('./minio', () => ({
  uploadDirectory: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./build-exchange', () => ({
  createIsolatedBuild: jest.fn(),
  waitForIsolatedBuild: jest.fn(),
  cleanupIsolatedBuild: jest.fn(),
}));
jest.mock('./path-security', () => ({
  validateRelativeDirectory: jest.fn((value: string) => value),
  resolvePathWithin: jest.fn(
    (base: string, relative: string) => `${base}/${relative}`,
  ),
  resolveExistingDirectoryWithin: jest.fn((_base: string, candidate: string) =>
    Promise.resolve(candidate),
  ),
}));

const mockPrisma = {
  deployment: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  environmentVariable: {
    findMany: jest.fn(),
  },
  deploymentLogChunk: {
    create: jest.fn().mockResolvedValue({}),
  },
  project: {
    update: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
};

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
  };
});

describe('Worker - Environment Variables Injection', () => {
  let processor: any;
  let workerOptions: any;

  beforeAll(async () => {
    // Import worker to execute the file and register the Worker mock
    require('./worker');
    const WorkerMock = Worker as jest.MockedClass<any>;
    // The processor is the second argument passed to the Worker constructor
    processor = WorkerMock.mock.calls[0][1];
    workerOptions = WorkerMock.mock.calls[0][2];
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (createIsolatedBuild as jest.Mock).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
    });
    (waitForIsolatedBuild as jest.Mock).mockResolvedValue({ ok: true });
    (cleanupIsolatedBuild as jest.Mock).mockResolvedValue(undefined);
  });

  it('should fetch, decrypt, and write environment variables to .env before building', async () => {
    // Setup mock data
    const deployment = {
      id: 'dep_1',
      projectId: 'proj_1',
      status: 'QUEUED',
      repoUrl: 'https://github.com/test/repo',
      branch: 'main',
      s3Prefix: 'prefix',
      project: {
        id: 'proj_1',
        userId: 'user_1',
        name: 'Test Project',
        rootDirectory: './',
        buildCommand: 'npm run build',
        outputDirectory: 'dist',
      },
    };
    mockPrisma.deployment.findUnique.mockResolvedValue(deployment);
    mockPrisma.deployment.update.mockResolvedValue(deployment);

    mockPrisma.environmentVariable.findMany.mockResolvedValue([
      { key: 'API_KEY', encryptedValue: 'enc_1', iv: 'iv_1', authTag: 'tag_1' },
      { key: 'API_URL', encryptedValue: 'enc_2', iv: 'iv_2', authTag: 'tag_2' },
    ]);

    (decrypt as jest.Mock).mockImplementation((val, iv) => {
      if (val === 'enc_1') return 'secret-api-key';
      if (val === 'enc_2') return 'https://api.test.com';
      return 'val';
    });

    // Execute the job processor
    const mockJob = { data: { deploymentId: 'dep_1' } };
    await processor(mockJob);

    // Assert environment variables were fetched
    expect(mockPrisma.environmentVariable.findMany).toHaveBeenCalledWith({
      where: { projectId: 'proj_1' },
    });

    // Assert decrypt was called
    expect(decrypt).toHaveBeenCalledWith('enc_1', 'iv_1', 'tag_1');
    expect(decrypt).toHaveBeenCalledWith('enc_2', 'iv_2', 'tag_2');

    expect(createIsolatedBuild).toHaveBeenCalledWith(
      {
        repoUrl: 'https://github.com/test/repo',
        branch: 'main',
        rootDirectory: './',
        buildCommand: 'npm run build',
      },
      'API_KEY=secret-api-key\nAPI_URL=https://api.test.com\n',
    );
    expect(waitForIsolatedBuild).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.any(Function),
    );
    expect(cleanupIsolatedBuild).toHaveBeenCalled();
  });

  it('ignores untrusted repository fields in the queue job', async () => {
    const deployment = {
      id: 'dep_1',
      projectId: 'proj_1',
      status: 'QUEUED',
      repoUrl: 'https://github.com/owner/trusted-repo',
      branch: 'main',
      s3Prefix: 'prefix',
      project: {
        id: 'proj_1',
        userId: 'user_1',
        name: 'Trusted Project',
        rootDirectory: './',
        buildCommand: 'npm run build',
        outputDirectory: 'dist',
      },
    };
    mockPrisma.deployment.findUnique.mockResolvedValue(deployment);
    mockPrisma.deployment.update.mockResolvedValue(deployment);
    mockPrisma.environmentVariable.findMany.mockResolvedValue([]);
    await processor({
      data: {
        deploymentId: 'dep_1',
        repoUrl: 'https://github.com/attacker/repo',
        branch: 'attacker-branch',
      },
    });

    expect(createIsolatedBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        repoUrl: 'https://github.com/owner/trusted-repo',
        branch: 'main',
      }),
      '',
    );
    const request = (createIsolatedBuild as jest.Mock).mock.calls[0][0];
    expect(request.repoUrl).not.toBe('https://github.com/attacker/repo');
    expect(request.branch).not.toBe('attacker-branch');
  });

  it('limits global worker concurrency to two builds', () => {
    expect(workerOptions).toEqual(
      expect.objectContaining({ concurrency: 2 }),
    );
  });
});
