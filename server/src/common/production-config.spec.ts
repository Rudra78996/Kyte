import { assertProductionConfiguration } from './production-config';

const validProductionEnvironment = {
  NODE_ENV: 'production',
  BASE_DOMAIN: 'app.example.com',
  SITES_DOMAIN: 'sites.example.com',
  DOMAIN_CNAME_TARGET: 'app.example.com',
  DASHBOARD_ORIGINS: 'https://app.example.com',
  CLERK_AUTHORIZED_PARTIES: 'https://app.example.com',
  NEXT_PUBLIC_API_BASE_URL: 'https://app.example.com/api',
  GITHUB_CALLBACK_URL: 'https://app.example.com/github/callback',
  WEBHOOK_CALLBACK_URL: 'https://app.example.com/api/webhooks/github',
  NEXT_PUBLIC_SITES_DOMAIN: 'sites.example.com',
  NEXT_PUBLIC_SITES_SCHEME: 'https',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_example',
  CLERK_SECRET_KEY: 'sk_live_example',
  GITHUB_CLIENT_ID: 'github-client-id',
  GITHUB_CLIENT_SECRET: 'g'.repeat(40),
  GITHUB_WEBHOOK_SECRET: 'w'.repeat(32),
  DATABASE_URL: `postgresql://kyte:${'p'.repeat(48)}@postgres:5432/kyte`,
  REDIS_URL: `redis://:${'r'.repeat(48)}@redis:6379`,
  MINIO_ENDPOINT: 'http://minio:9000',
  MINIO_ACCESS_KEY: 'kyte-app',
  MINIO_SECRET_KEY: 'm'.repeat(48),
};

describe('production configuration', () => {
  it('accepts a strict production configuration', () => {
    expect(() =>
      assertProductionConfiguration(validProductionEnvironment),
    ).not.toThrow();
  });

  it('does nothing outside production', () => {
    expect(() =>
      assertProductionConfiguration({ NODE_ENV: 'development' }),
    ).not.toThrow();
  });

  it.each([
    ['BASE_DOMAIN', 'localhost'],
    ['SITES_DOMAIN', 'app.example.com'],
    ['DASHBOARD_ORIGINS', 'https://app.example.com,https://attacker.example'],
    ['CLERK_AUTHORIZED_PARTIES', 'https://attacker.example'],
    ['NEXT_PUBLIC_API_BASE_URL', 'http://app.example.com/api'],
    ['GITHUB_CALLBACK_URL', 'https://attacker.example/github/callback'],
    ['WEBHOOK_CALLBACK_URL', 'http://app.example.com/api/webhooks/github'],
    ['NEXT_PUBLIC_SITES_DOMAIN', 'app.example.com'],
    ['NEXT_PUBLIC_SITES_SCHEME', 'http'],
    ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_example'],
    ['CLERK_SECRET_KEY', 'sk_test_example'],
    ['DATABASE_URL', 'postgresql://kyte:password@public-db:5432/kyte'],
    ['REDIS_URL', 'redis://redis:6379'],
    ['MINIO_ENDPOINT', 'https://storage.example.com'],
  ])('rejects unsafe %s', (name, value) => {
    expect(() =>
      assertProductionConfiguration({
        ...validProductionEnvironment,
        [name]: value,
      }),
    ).toThrow();
  });
});
