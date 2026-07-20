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
    const signature = req.headers['x-hub-signature-256'];
    if (
      typeof signature !== 'string' ||
      !/^sha256=[a-f0-9]{64}$/i.test(signature)
    ) {
      throw new UnauthorizedException('Missing X-Hub-Signature-256 header');
    }
    const event = req.headers['x-github-event'];
    if (
      typeof event !== 'string' ||
      !/^[a-z][a-z0-9_]{0,39}$/.test(event)
    ) {
      throw new UnauthorizedException('Invalid X-GitHub-Event header');
    }
    const deliveryId = req.headers['x-github-delivery'];
    if (
      typeof deliveryId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        deliveryId,
      )
    ) {
      throw new UnauthorizedException('Invalid X-GitHub-Delivery header');
    }

    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
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
