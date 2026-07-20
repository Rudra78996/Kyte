import { AuthService } from './auth.service';

describe('AuthService GitHub security', () => {
  const stateStore = new Map<string, string>();
  const redis = {
    set: jest.fn(async (key: string, value: string) => {
      if (stateStore.has(key)) return null;
      stateStore.set(key, value);
      return 'OK';
    }),
    getdel: jest.fn(async (key: string) => {
      const value = stateStore.get(key) ?? null;
      stateStore.delete(key);
      return value;
    }),
    quit: jest.fn(),
  };
  const prisma = {
    user: { findUnique: jest.fn() },
    gitHubConnection: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    project: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (operations) => Promise.all(operations)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    stateStore.clear();
    process.env.GITHUB_CLIENT_ID = 'github-client';
    process.env.GITHUB_CLIENT_SECRET = 'github-secret';
  });

  it('uses a random, single-use state and stores the token with AES-GCM', async () => {
    const service = new AuthService(prisma as any, redis as any);
    const state = await service.generateGithubState('user_1');
    expect(state).toMatch(/^[A-Za-z0-9_-]{40,128}$/);
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^github:oauth-state:[a-f0-9]{64}$/),
      JSON.stringify({ userId: 'user_1' }),
      'EX',
      900,
      'NX',
    );
    prisma.gitHubConnection.findUnique.mockResolvedValue(null);
    prisma.gitHubConnection.upsert.mockResolvedValue({ id: 'connection_1' });
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'github-plaintext-token', scope: 'repo' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 42, login: 'octocat' }),
      } as Response);

    await service.handleGithubCallback('oauth-code', state, 'user_1');

    const data = prisma.gitHubConnection.upsert.mock.calls[0][0].create;
    expect(data.accessTokenEncrypted).not.toContain('github-plaintext-token');
    expect(data.tokenIv).toBeTruthy();
    expect(data.tokenAuthTag).toBeTruthy();
    expect(JSON.stringify(data)).not.toContain('github-plaintext-token');

    await expect(
      service.handleGithubCallback('same-code', state, 'user_1'),
    ).rejects.toThrow('Invalid or expired state');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('consumes state before rejecting a callback from another user', async () => {
    const service = new AuthService(prisma as any, redis as any);
    const state = await service.generateGithubState('user_1');

    await expect(
      service.handleGithubCallback('oauth-code', state, 'user_2'),
    ).rejects.toThrow('different session');
    await expect(
      service.handleGithubCallback('oauth-code', state, 'user_1'),
    ).rejects.toThrow('Invalid or expired state');
  });

  it('does not transfer a GitHub connection to another Kyte user', async () => {
    const service = new AuthService(prisma as any, redis as any);
    const state = await service.generateGithubState('user_2');
    prisma.gitHubConnection.findUnique.mockResolvedValue({
      id: 'connection_1',
      userId: 'user_1',
      githubUserId: '42',
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'github-token', scope: 'repo' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 42, login: 'octocat' }),
      } as Response);

    await expect(
      service.handleGithubCallback('oauth-code', state, 'user_2'),
    ).rejects.toThrow('already connected to another Kyte account');
    expect(prisma.gitHubConnection.upsert).not.toHaveBeenCalled();
  });

  it('deletes local credentials even when remote webhook cleanup fails', async () => {
    const service = new AuthService(prisma as any, redis as any);
    prisma.gitHubConnection.findFirst.mockResolvedValue({
      id: 'connection_1',
      userId: 'user_1',
      accessTokenEncrypted: null,
      tokenIv: null,
      tokenAuthTag: null,
    });
    prisma.project.findMany.mockResolvedValue([
      {
        repoUrl: 'https://github.com/example/project',
        webhookId: 'hook_1',
      },
    ]);
    prisma.project.updateMany.mockResolvedValue({ count: 1 });
    prisma.gitHubConnection.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      service.disconnectGithub({
        id: 'user_1',
        email: 'user@example.com',
        clerkId: 'clerk_1',
      }),
    ).resolves.toEqual({ disconnected: true, cleanupWarnings: 1 });
    expect(prisma.project.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      data: { webhookId: null },
    });
    expect(prisma.gitHubConnection.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
    });
  });
});
