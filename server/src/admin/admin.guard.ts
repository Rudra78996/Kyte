import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';

function configuredAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Admin access required');

    const adminEmails = configuredAdminEmails();
    const [account] = await this.prisma.$queryRaw<
      { email: string; role: 'USER' | 'ADMIN' }[]
    >`SELECT "email", "role"::text AS "role" FROM "User" WHERE "id" = ${user.id} LIMIT 1`;

    if (
      account?.role === 'ADMIN' ||
      (account?.email && adminEmails.includes(account.email.toLowerCase()))
    ) {
      if (account.role !== 'ADMIN') {
        await this.prisma.$executeRaw`UPDATE "User" SET "role" = 'ADMIN'::"UserRole" WHERE "id" = ${user.id}`;
      }
      return true;
    }

    throw new ForbiddenException('Admin access required');
  }
}
