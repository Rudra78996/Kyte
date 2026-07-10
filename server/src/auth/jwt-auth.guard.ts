import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private clerkClient;

  constructor(private readonly prisma: PrismaService) {
    this.clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    let token = '';
    const header = request.headers.authorization;
    if (header) {
      const [scheme, t] = header.split(' ');
      if (scheme === 'Bearer' && t) {
        token = t;
      }
    } else if (request.query.token && typeof request.query.token === 'string') {
      token = request.query.token;
    }

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    try {
      const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
      const clerkId = payload.sub;

      // Find or create user in database
      let user = await this.prisma.user.findUnique({ where: { clerkId } });
      if (!user) {
        // Fetch user details from Clerk
        const clerkUser = await this.clerkClient.users.getUser(clerkId);
        const email =
          clerkUser.emailAddresses.find(
            (e) => e.id === clerkUser.primaryEmailAddressId,
          )?.emailAddress || '';
          
        // Try to link existing user by email
        user = await this.prisma.user.findUnique({ where: { email } });
        
        if (user) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { clerkId },
          });
        } else {
          user = await this.prisma.user.create({
            data: {
              clerkId,
              email,
              username: clerkUser.username || email.split('@')[0],
            },
          });
        }
      }

      request.user = { id: user.id, email: user.email, clerkId };
      return true;
    } catch (e) {
      console.error('JwtAuthGuard Error:', e);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
