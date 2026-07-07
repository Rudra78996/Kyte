import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthTokenPayload, AuthenticatedUser } from './auth.types';

type AuthSuccessResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterDto): Promise<AuthSuccessResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new BadRequestException('Invalid email address');
    }

    if (!input.password || input.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
      },
    });

    const accessToken = await this.issueAccessToken({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user,
    };
  }

  async login(input: LoginDto): Promise<AuthSuccessResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const matches = await bcrypt.compare(input.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.issueAccessToken({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

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

  private issueAccessToken(payload: AuthTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
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

