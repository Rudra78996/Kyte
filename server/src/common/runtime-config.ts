export function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be configured`);
  }
  return value;
}

export function requireAuthenticatedRedisUrl(): string {
  const value = requireEnvironment('REDIS_URL');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('REDIS_URL must be a valid URL');
  }
  if (!['redis:', 'rediss:'].includes(url.protocol)) {
    throw new Error('REDIS_URL must use redis:// or rediss://');
  }
  if (!url.password) {
    throw new Error('REDIS_URL must include a password');
  }
  return value;
}
