import { Worker } from 'bullmq';
import * as fs from 'fs-extra';

jest.mock('node:http', () => ({
  createServer: jest.fn().mockReturnValue({
    listen: jest.fn(),
  }),
}));
import execa from 'execa';
import { decrypt } from '../utils/crypto.util';

jest.mock('bullmq', () => {
  return {
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
    })),
  };
});
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('execa');
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    publish: jest.fn(),
  }));
});
jest.mock('../utils/crypto.util', () => ({
  decrypt: jest.fn(),
}));
jest.mock('./minio', () => ({
  uploadDirectory: jest.fn().mockResolvedValue(undefined),
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
  }
};

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrisma)
  };
});

describe('Worker - Environment Variables Injection', () => {
  let processor: any;

  beforeAll(async () => {
    // Import worker to execute the file and register the Worker mock
    require('./worker');
    const WorkerMock = Worker as jest.MockedClass<any>;
    // The processor is the second argument passed to the Worker constructor
    processor = WorkerMock.mock.calls[0][1];
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch, decrypt, and write environment variables to .env before building', async () => {
    // Setup mock data
    mockPrisma.deployment.update.mockResolvedValue({
      id: 'dep_1',
      projectId: 'proj_1',
      repoUrl: 'https://github.com/test/repo',
      branch: 'main',
      s3Prefix: 'prefix',
      project: {
        id: 'proj_1',
        userId: 'user_1',
        name: 'Test Project',
        rootDirectory: './',
        buildCommand: 'npm run build',
        outputDirectory: 'dist'
      }
    });

    mockPrisma.environmentVariable.findMany.mockResolvedValue([
      { key: 'API_KEY', encryptedValue: 'enc_1', iv: 'iv_1' },
      { key: 'API_URL', encryptedValue: 'enc_2', iv: 'iv_2' }
    ]);

    (decrypt as jest.Mock).mockImplementation((val, iv) => {
      if (val === 'enc_1') return 'secret-api-key';
      if (val === 'enc_2') return 'https://api.test.com';
      return 'val';
    });

    const execaMock = execa as unknown as jest.Mock;
    execaMock.mockReturnValue(Promise.resolve({ stdout: '', stderr: '' }));

    // Execute the job processor
    const mockJob = { data: { deploymentId: 'dep_1' } };
    await processor(mockJob);

    // Assert environment variables were fetched
    expect(mockPrisma.environmentVariable.findMany).toHaveBeenCalledWith({
      where: { projectId: 'proj_1' }
    });

    // Assert decrypt was called
    expect(decrypt).toHaveBeenCalledWith('enc_1', 'iv_1');
    expect(decrypt).toHaveBeenCalledWith('enc_2', 'iv_2');

    // Assert .env file was written securely
    expect(fs.writeFile).toHaveBeenCalled();
    const writeFileCall = (fs.writeFile as jest.Mock).mock.calls[0];
    const writtenPath = writeFileCall[0];
    const writtenContent = writeFileCall[1];
    
    expect(writtenPath).toMatch(/\.env$/);
    expect(writtenContent).toContain('API_KEY=secret-api-key\n');
    expect(writtenContent).toContain('API_URL=https://api.test.com\n');

    // Assert the shell script contains the logic to copy the .env file into the app directory
    const execaCall = execaMock.mock.calls[0];
    expect(execaCall[0]).toBe('nsjail');
    const shellScript = execaCall[1][execaCall[1].indexOf('-c') + 1];
    
    expect(shellScript).toContain('cp /build/.env /build/app/.//.env');
  });
});
