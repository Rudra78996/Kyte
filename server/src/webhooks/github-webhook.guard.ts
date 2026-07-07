import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Request } from 'express';

@Injectable()
export class GithubWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    
    // GitHub signature is required
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      throw new UnauthorizedException('Missing X-Hub-Signature-256 header');
    }

    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      // If no secret configured, reject or allow based on policy.
      // Usually we must have a secret for webhooks.
      throw new UnauthorizedException('Webhook secret not configured');
    }

    // Verify signature
    // The raw body is available because we set rawBody: true in main.ts
    // NestJS populates req.rawBody as a Buffer
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      throw new UnauthorizedException('Missing raw request body');
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
