import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt, encrypt } from '../utils/crypto.util';
import { AuthenticatedUser } from './auth.types';

export const GITHUB_OAUTH_REDIS = Symbol('GITHUB_OAUTH_REDIS');
const OAUTH_STATE_TTL_SECONDS = 15 * 60;
const OAUTH_STATE_PREFIX = 'github:oauth-state:';

@Injectable()
export class AuthService implements OnModuleDestroy {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(GITHUB_OAUTH_REDIS) private readonly redis: Redis,
  ) {}

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async me(user: AuthenticatedUser): Promise<{
    id: string;
    email: string;
    isAdmin: boolean;
    githubConnected: boolean;
    githubUsername?: string;
  }> {
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        role: true,
        githubConnections: {
          select: {
            githubUsername: true,
            accessTokenEncrypted: true,
            tokenIv: true,
            tokenAuthTag: true,
          },
          take: 1,
        },
      },
    });

    if (!account) throw new UnauthorizedException('User not found');
    const githubConn = account.githubConnections?.[0];
    const githubConnected = Boolean(
      githubConn?.accessTokenEncrypted &&
      githubConn.tokenIv &&
      githubConn.tokenAuthTag,
    );

    return {
      id: account.id,
      email: account.email,
      isAdmin:
        account.role === 'ADMIN' ||
        (process.env.ADMIN_EMAILS || '')
          .split(',')
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean)
          .includes(account.email.toLowerCase()),
      githubConnected,
      githubUsername: githubConnected ? githubConn?.githubUsername : undefined,
    };
  }

  async githubRepos(user: AuthenticatedUser) {
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { githubConnections: { take: 1 } },
    });
    const githubConn = account?.githubConnections?.[0];
    if (
      !githubConn?.accessTokenEncrypted ||
      !githubConn.tokenIv ||
      !githubConn.tokenAuthTag
    ) {
      throw new BadRequestException('GitHub is not connected');
    }
    const accessToken = decrypt(
      githubConn.accessTokenEncrypted,
      githubConn.tokenIv,
      githubConn.tokenAuthTag,
    );
    const response = await fetch(
      'https://api.github.com/user/repos?visibility=all&per_page=100&sort=updated',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );
    if (!response.ok) {
      throw new BadRequestException('Failed to fetch repositories from GitHub');
    }
    const repos = (await response.json()) as any[];
    return repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      htmlUrl: repo.html_url,
      updatedAt: repo.updated_at,
    }));
  }

  async generateGithubState(userId: string): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const state = randomBytes(32).toString('base64url');
      const stored = await this.redis.set(
        this.oauthStateKey(state),
        JSON.stringify({ userId }),
        'EX',
        OAUTH_STATE_TTL_SECONDS,
        'NX',
      );
      if (stored === 'OK') return state;
    }
    throw new BadRequestException('Could not start GitHub connection');
  }

  private oauthStateKey(state: string) {
    const digest = createHash('sha256').update(state).digest('hex');
    return `${OAUTH_STATE_PREFIX}${digest}`;
  }

  private async consumeGithubState(state: string, currentUserId: string) {
    if (!/^[A-Za-z0-9_-]{40,128}$/.test(state)) {
      throw new BadRequestException('Invalid or expired state');
    }
    const stored = await this.redis.getdel(this.oauthStateKey(state));
    if (!stored) throw new BadRequestException('Invalid or expired state');
    let stateData: { userId?: string };
    try {
      stateData = JSON.parse(stored);
    } catch {
      throw new BadRequestException('Invalid or expired state');
    }
    if (stateData.userId !== currentUserId) {
      throw new BadRequestException(
        'The GitHub connection belongs to a different session',
      );
    }
  }

  async handleGithubCallback(
    code: string,
    state: string,
    currentUserId: string,
  ): Promise<void> {
    await this.consumeGithubState(state, currentUserId);
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'GitHub OAuth is not configured on the server',
      );
    }

    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      },
    );
    if (!tokenResponse.ok) {
      throw new BadRequestException('GitHub rejected the connection request');
    }
    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      scope?: string;
    };
    if (!tokenData.access_token) {
      throw new BadRequestException('Failed to get access token from GitHub');
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!userResponse.ok) {
      throw new BadRequestException('Failed to fetch GitHub profile');
    }
    const githubUser = (await userResponse.json()) as {
      id?: number;
      login?: string;
    };
    if (!githubUser.id || !githubUser.login) {
      throw new BadRequestException('Failed to fetch GitHub profile');
    }

    const githubId = githubUser.id.toString();
    const existing = await this.prisma.gitHubConnection.findUnique({
      where: { githubUserId: githubId },
    });
    if (existing && existing.userId !== currentUserId) {
      throw new BadRequestException(
        'This GitHub account is already connected to another Kyte account. Disconnect it there first.',
      );
    }

    const encrypted = encrypt(tokenData.access_token);
    try {
      await this.prisma.gitHubConnection.upsert({
        where: { githubUserId: githubId },
        update: {
          githubUsername: githubUser.login,
          accessTokenEncrypted: encrypted.encryptedValue,
          tokenIv: encrypted.iv,
          tokenAuthTag: encrypted.authTag,
          scopes: tokenData.scope || '',
        },
        create: {
          userId: currentUserId,
          githubUserId: githubId,
          githubUsername: githubUser.login,
          accessTokenEncrypted: encrypted.encryptedValue,
          tokenIv: encrypted.iv,
          tokenAuthTag: encrypted.authTag,
          scopes: tokenData.scope || '',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'This GitHub account was connected elsewhere. Refresh and try again.',
        );
      }
      throw error;
    }
  }

  async disconnectGithub(user: AuthenticatedUser) {
    const connection = await this.prisma.gitHubConnection.findFirst({
      where: { userId: user.id },
    });
    if (!connection) return { disconnected: true, cleanupWarnings: 0 };

    const projects = await this.prisma.project.findMany({
      where: { userId: user.id, webhookId: { not: null } },
      select: { repoUrl: true, webhookId: true },
    });
    let accessToken: string | undefined;
    if (
      connection.accessTokenEncrypted &&
      connection.tokenIv &&
      connection.tokenAuthTag
    ) {
      try {
        accessToken = decrypt(
          connection.accessTokenEncrypted,
          connection.tokenIv,
          connection.tokenAuthTag,
        );
      } catch {
        // Local deletion still proceeds so unusable token material is removed.
      }
    }

    let cleanupWarnings = 0;
    for (const project of projects) {
      const repository = this.parseGitHubRepository(project.repoUrl);
      if (!accessToken || !repository || !project.webhookId) {
        cleanupWarnings++;
        continue;
      }
      try {
        const response = await fetch(
          `https://api.github.com/repos/${repository.owner}/${repository.repo}/hooks/${project.webhookId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github+json',
            },
          },
        );
        if (!response.ok && response.status !== 404) cleanupWarnings++;
      } catch {
        cleanupWarnings++;
      }
    }

    await this.prisma.$transaction([
      this.prisma.project.updateMany({
        where: { userId: user.id },
        data: { webhookId: null },
      }),
      this.prisma.gitHubConnection.deleteMany({
        where: { userId: user.id },
      }),
    ]);
    return { disconnected: true, cleanupWarnings };
  }

  private parseGitHubRepository(repoUrl: string) {
    const normalized = repoUrl
      .trim()
      .replace(/^git@github\.com:/i, '')
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\/+$/, '')
      .replace(/\.git$/i, '');
    const [owner, repo, ...extra] = normalized.split('/');
    return owner && repo && extra.length === 0 ? { owner, repo } : null;
  }
}
