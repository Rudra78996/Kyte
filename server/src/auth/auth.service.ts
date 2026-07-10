import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async me(user: AuthenticatedUser): Promise<{ id: string; email: string; githubConnected: boolean; githubUsername?: string }> {
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        githubConnections: {
          select: {
            githubUsername: true
          },
          take: 1
        }
      },
    });

    if (!account) {
      throw new UnauthorizedException('User not found');
    }

    const githubConn = account.githubConnections?.[0];

    return {
      id: account.id,
      email: account.email,
      githubConnected: !!githubConn,
      githubUsername: githubConn?.githubUsername || undefined,
    };
  }

  async generateGithubState(userId: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId, purpose: 'github_oauth' }, { expiresIn: '15m' });
  }

  async handleGithubCallback(code: string, state: string): Promise<void> {
    let payload;
    try {
      payload = await this.jwtService.verifyAsync(state);
    } catch (e) {
      throw new BadRequestException('Invalid or expired state');
    }
    
    if (payload.purpose !== 'github_oauth' || !payload.sub) {
      throw new BadRequestException('Invalid state payload');
    }
    const userId = payload.sub;

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new BadRequestException('GitHub OAuth is not configured on the server');
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      })
    });
    
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
       throw new BadRequestException('Failed to get access token from GitHub');
    }
    
    const accessToken = tokenData.access_token;
    
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      }
    });
    
    const githubUser = await userRes.json();
    if (!githubUser.id) {
       throw new BadRequestException('Failed to fetch GitHub profile');
    }

    // Encrypt access token (simple base64 for now, should be upgraded to AES in Phase 7)
    const accessTokenEncrypted = Buffer.from(accessToken).toString('base64');
    
    await this.prisma.gitHubConnection.upsert({
      where: { githubUserId: githubUser.id.toString() },
      update: {
        userId,
        githubUsername: githubUser.login,
        accessTokenEncrypted,
        scopes: tokenData.scope || '',
      },
      create: {
        userId,
        githubUserId: githubUser.id.toString(),
        githubUsername: githubUser.login,
        accessTokenEncrypted,
        scopes: tokenData.scope || '',
      }
    });
  }
}
