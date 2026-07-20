import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import { JwtAuthGuard } from './jwt-auth.guard';

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(),
}));

describe('JwtAuthGuard', () => {
  const authenticateRequest = jest.fn();
  const getUser = jest.fn();
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'sk_test_example';
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';
    process.env.CLERK_AUTHORIZED_PARTIES = 'https://kyte.example';
    jest.mocked(createClerkClient).mockReturnValue({
      authenticateRequest,
      users: { getUser },
    } as any);
    jest.clearAllMocks();
  });

  function context(headers: Record<string, string> = {}, query = {}) {
    const request: any = {
      headers,
      query,
      method: 'GET',
      protocol: 'https',
      originalUrl: '/projects',
      get: (name: string) =>
        name === 'host' ? 'kyte.example' : headers[name.toLowerCase()],
    };
    return {
      request,
      executionContext: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as ExecutionContext,
    };
  }

  it('does not treat a query-string token as authentication', async () => {
    authenticateRequest.mockResolvedValue({ isAuthenticated: false });
    const guard = new JwtAuthGuard(prisma as any);
    const { executionContext } = context({}, { token: 'leaked-token' });

    await expect(guard.canActivate(executionContext)).rejects.toThrow(
      UnauthorizedException,
    );
    const webRequest = authenticateRequest.mock.calls[0][0] as Request;
    expect(webRequest.headers.get('authorization')).toBeNull();
    expect(authenticateRequest.mock.calls[0][1]).toEqual({
      authorizedParties: ['https://kyte.example'],
      acceptsToken: 'session_token',
    });
  });

  it('links an existing user only from a verified primary Clerk email', async () => {
    authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => ({ userId: 'clerk_1' }),
    });
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'user_1', email: 'user@example.com' });
    prisma.user.update.mockResolvedValue({
      id: 'user_1',
      email: 'user@example.com',
      clerkId: 'clerk_1',
    });
    getUser.mockResolvedValue({
      primaryEmailAddressId: 'email_1',
      username: null,
      emailAddresses: [
        {
          id: 'email_1',
          emailAddress: 'USER@example.com',
          verification: { status: 'verified' },
        },
      ],
    });
    const guard = new JwtAuthGuard(prisma as any);
    const { request, executionContext } = context({
      authorization: 'Bearer session-token',
    });

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { email: 'user@example.com' },
    });
    expect(request.user.id).toBe('user_1');
  });

  it('rejects an unverified primary email before linking or creating', async () => {
    authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => ({ userId: 'clerk_2' }),
    });
    prisma.user.findUnique.mockResolvedValue(null);
    getUser.mockResolvedValue({
      primaryEmailAddressId: 'email_2',
      emailAddresses: [
        {
          id: 'email_2',
          emailAddress: 'unverified@example.com',
          verification: { status: 'unverified' },
        },
      ],
    });
    const guard = new JwtAuthGuard(prisma as any);

    await expect(guard.canActivate(context().executionContext)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
