import { assertWebhookSecretConfigured } from './webhook-config';

describe('webhook configuration', () => {
  it('requires at least 32 bytes of webhook secret material', () => {
    expect(() =>
      assertWebhookSecretConfigured({ GITHUB_WEBHOOK_SECRET: 'short' }),
    ).toThrow('at least 32 bytes');
    expect(() =>
      assertWebhookSecretConfigured({
        GITHUB_WEBHOOK_SECRET: 'x'.repeat(32),
      }),
    ).not.toThrow();
  });
});
