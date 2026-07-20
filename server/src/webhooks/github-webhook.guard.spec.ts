import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { GithubWebhookGuard } from './github-webhook.guard';

describe('GithubWebhookGuard', () => {
  const secret = 'a-secure-webhook-secret-with-32-bytes';
  const body = Buffer.from('{"zen":"keep it logically awesome"}');

  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = secret;
  });

  function context(headers: Record<string, string>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers, rawBody: body }),
      }),
    } as ExecutionContext;
  }

  it('requires event, UUID delivery ID, and a valid SHA-256 signature', () => {
    const signature = `sha256=${createHmac('sha256', secret)
      .update(body)
      .digest('hex')}`;
    const guard = new GithubWebhookGuard();
    expect(
      guard.canActivate(
        context({
          'x-hub-signature-256': signature,
          'x-github-event': 'push',
          'x-github-delivery': '11111111-1111-4111-8111-111111111111',
        }),
      ),
    ).toBe(true);
  });

  it('rejects malformed or missing delivery headers', () => {
    const guard = new GithubWebhookGuard();
    expect(() =>
      guard.canActivate(
        context({
          'x-hub-signature-256': `sha256=${'0'.repeat(64)}`,
          'x-github-event': 'push',
          'x-github-delivery': 'not-a-uuid',
        }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a webhook secret shorter than 32 bytes', () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'too-short';
    const guard = new GithubWebhookGuard();
    expect(() =>
      guard.canActivate(
        context({
          'x-hub-signature-256': `sha256=${'0'.repeat(64)}`,
          'x-github-event': 'push',
          'x-github-delivery': '11111111-1111-4111-8111-111111111111',
        }),
      ),
    ).toThrow('Webhook secret not configured');
  });
});
