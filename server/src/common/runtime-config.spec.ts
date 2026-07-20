import {
  requireAuthenticatedRedisUrl,
  requireEnvironment,
} from './runtime-config';

describe('runtime security configuration', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  it('rejects missing required values', () => {
    delete process.env.REQUIRED_TEST_VALUE;
    expect(() => requireEnvironment('REQUIRED_TEST_VALUE')).toThrow(
      'REQUIRED_TEST_VALUE must be configured',
    );
  });

  it('requires Redis authentication', () => {
    process.env.REDIS_URL = 'redis://redis:6379';
    expect(() => requireAuthenticatedRedisUrl()).toThrow(
      'REDIS_URL must include a password',
    );

    process.env.REDIS_URL = 'redis://:strong-password@redis:6379';
    expect(requireAuthenticatedRedisUrl()).toBe(
      'redis://:strong-password@redis:6379',
    );
  });
});
