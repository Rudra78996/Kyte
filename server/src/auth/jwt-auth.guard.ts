import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import type { Request as ExpressRequest } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './auth.types';
import { getClerkVerificationOptions } from './clerk-auth.config';

/**
 * TTL for the in-process user-lookup cache. Clerk session JWTs are short-lived
 * (~60 s), so a 55-second cache means we almost never hit the DB twice for the
 * same token. The cache is purely in-memory (no Redis needed) and evicts
 * itself naturally — perfect for single-instance deployments.
 */
const CACHE_TTL_MS = 55_000;

interface CacheEntry {
  user: { id: string; email: string; clerkId: string };
  expiresAt: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private clerkClient;

  /**
   * Simple in-memory cache keyed by Clerk user ID. Avoids a DB round-trip
   * on every authenticated request for returning users.
   */
  private userCache = new Map<string, CacheEntry>();
  private readonly verificationOptions;

  constructor(private readonly prisma: PrismaService) {
    this.verificationOptions = getClerkVerificationOptions();
    this.clerkClient = createClerkClient({
      secretKey: this.verificationOptions.secretKey,
      publishableKey: this.verificationOptions.publishableKey,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<ExpressRequest & { user?: AuthenticatedUser }>();

    try {
      const host = request.get('host');
      if (!host) throw new UnauthorizedException('Missing request host');
      const url = `${request.protocol}://${host}${request.originalUrl}`;
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) {
          value.forEach((item) => headers.append(name, item));
        } else if (value !== undefined) {
          headers.set(name, value);
        }
      }
      const requestState = await this.clerkClient.authenticateRequest(
        new globalThis.Request(url, {
          method: request.method,
          headers,
        }),
        {
          authorizedParties: this.verificationOptions.authorizedParties,
          acceptsToken: 'session_token',
        },
      );
      if (!requestState.isAuthenticated) {
        throw new UnauthorizedException('Invalid or expired session');
      }
      const { userId: clerkId } = requestState.toAuth();
      if (!clerkId) throw new UnauthorizedException('Invalid Clerk user');

      // Check cache first — returning users skip the DB entirely.
      const cached = this.userCache.get(clerkId);
      if (cached && cached.expiresAt > Date.now()) {
        request.user = cached.user;
        return true;
      }

      // Find or create user in database
      let user = await this.prisma.user.findUnique({ where: { clerkId } });
      if (!user) {
        // Fetch user details from Clerk
        const clerkUser = await this.clerkClient.users.getUser(clerkId);
        const primaryEmail = clerkUser.emailAddresses.find(
          (email) => email.id === clerkUser.primaryEmailAddressId,
        );
        if (
          !primaryEmail ||
          primaryEmail.verification?.status !== 'verified'
        ) {
          throw new UnauthorizedException(
            'A verified primary email is required',
          );
        }
        const email = primaryEmail.emailAddress.toLowerCase();

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

      const authUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        clerkId,
      };

      // Populate cache for subsequent requests.
      this.userCache.set(clerkId, {
        user: authUser,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      request.user = authUser;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
