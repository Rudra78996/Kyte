import { readFileSync } from 'node:fs';
import * as path from 'node:path';

const repositoryRoot = path.resolve(__dirname, '../../..');
const read = (relativePath: string) =>
  readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

describe('Phase 7 infrastructure hardening', () => {
  const compose = read('docker-compose.yml');
  const caddy = read('Caddyfile');
  const apiDockerfile = read('server/Dockerfile');
  const webDockerfile = read('web/Dockerfile');

  it('requires authenticated Redis and does not publish it', () => {
    const redis = compose
      .split('\n  redis:')[1]
      .split('\n  postgres:')[0];
    expect(redis).toContain('--requirepass');
    expect(redis).toContain('REDIS_PASSWORD');
    expect(redis).not.toContain('\n    ports:');
    expect(compose).not.toContain('redis://redis:6379');
  });

  it('uses a bucket-scoped MinIO application identity', () => {
    expect(compose).toContain('minio-init:');
    expect(compose).toContain('mc admin policy attach local kyte-app');
    expect(compose).toContain('MINIO_ROOT_USER');
    expect(read('infra/minio/kyte-policy.json')).toContain(
      'arn:aws:s3:::deployly-projects/*',
    );
  });

  it('runs API and web as non-root with restricted containers', () => {
    expect(apiDockerfile).toContain('USER node');
    expect(webDockerfile).toContain('USER node');
    for (const service of ['api', 'web']) {
      const block = compose
        .split(`\n  ${service}:`)[1]
        .split(/\n  [a-z][a-z-]+:/)[0];
      expect(block).toContain('read_only: true');
      expect(block).toContain('cap_drop:\n      - ALL');
      expect(block).toContain('no-new-privileges:true');
    }
  });

  it('pins runtime images and adds dashboard security headers', () => {
    expect(compose).toMatch(/image: postgres@sha256:[a-f0-9]{64}/);
    expect(compose).toMatch(/image: redis@sha256:[a-f0-9]{64}/);
    expect(compose).toMatch(/image: caddy@sha256:[a-f0-9]{64}/);
    expect(caddy).toContain('Strict-Transport-Security');
    expect(caddy).toContain('X-Content-Type-Options "nosniff"');
    expect(caddy).toContain('X-Frame-Options "DENY"');
  });

  it('keeps rate limiting on webhooks, log streams, and Caddy checks', () => {
    const source = [
      read('server/src/webhooks/webhooks.controller.ts'),
      read('server/src/deployments/deployments.controller.ts'),
      read('server/src/caddy.controller.ts'),
    ].join('\n');
    expect(source).not.toContain('SkipThrottle');
    expect(source).toContain(
      '@Throttle({ default: { limit: 120, ttl: 60_000 } })',
    );
    expect(source).toContain(
      '@Throttle({ default: { limit: 20, ttl: 60_000 } })',
    );
    expect(source).toContain(
      '@Throttle({ default: { limit: 30, ttl: 60_000 } })',
    );
  });
});
