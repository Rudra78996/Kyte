const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const INSECURE_SECRET_VALUES = new Set([
  'admin',
  'change_me',
  'changeme',
  'password',
  'postgres',
  'replace_me',
  'secret',
]);

type ProductionEnvironment = Record<string, string | undefined>;

function required(env: ProductionEnvironment, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be configured in production`);
  }
  return value;
}

function productionHostname(env: ProductionEnvironment, name: string): string {
  const hostname = required(env, name).toLowerCase();
  if (
    !HOSTNAME_PATTERN.test(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localhost')
  ) {
    throw new Error(`${name} must be a public DNS hostname in production`);
  }
  return hostname;
}

function isSubdomainOf(hostname: string, parentDomain: string): boolean {
  return hostname !== parentDomain && hostname.endsWith(`.${parentDomain}`);
}

function requireExactUrl(
  env: ProductionEnvironment,
  name: string,
  expected: string,
) {
  const value = required(env, name);
  if (value !== expected) {
    throw new Error(`${name} must be exactly ${expected} in production`);
  }
}

function requireStrongSecret(
  env: ProductionEnvironment,
  name: string,
  minimumBytes = 32,
) {
  const value = required(env, name);
  if (
    Buffer.byteLength(value, 'utf8') < minimumBytes ||
    INSECURE_SECRET_VALUES.has(value.toLowerCase()) ||
    /replace|change[_-]?me/i.test(value)
  ) {
    throw new Error(
      `${name} must be an independently generated production secret of at least ${minimumBytes} bytes`,
    );
  }
}

export function assertProductionConfiguration(
  env: ProductionEnvironment = process.env,
) {
  if (env.NODE_ENV?.trim() !== 'production') {
    return;
  }

  const baseDomain = productionHostname(env, 'BASE_DOMAIN');
  const sitesDomain = productionHostname(env, 'SITES_DOMAIN');
  const domainCnameTarget = productionHostname(env, 'DOMAIN_CNAME_TARGET');
  if (baseDomain === sitesDomain) {
    throw new Error(
      'SITES_DOMAIN must be different from BASE_DOMAIN in production',
    );
  }
  if (isSubdomainOf(baseDomain, sitesDomain)) {
    throw new Error(
      'BASE_DOMAIN must not be inside the untrusted SITES_DOMAIN zone',
    );
  }
  if (domainCnameTarget === baseDomain) {
    throw new Error(
      'DOMAIN_CNAME_TARGET must be a dedicated origin hostname, not BASE_DOMAIN',
    );
  }
  if (
    domainCnameTarget === sitesDomain ||
    isSubdomainOf(domainCnameTarget, sitesDomain)
  ) {
    throw new Error(
      'DOMAIN_CNAME_TARGET must not be inside the untrusted SITES_DOMAIN zone',
    );
  }

  const dashboardOrigin = `https://${baseDomain}`;
  const origins = required(env, 'DASHBOARD_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length !== 1 || origins[0] !== dashboardOrigin) {
    throw new Error(
      `DASHBOARD_ORIGINS must contain only ${dashboardOrigin} in production`,
    );
  }

  const authorizedParties = required(env, 'CLERK_AUTHORIZED_PARTIES')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (
    authorizedParties.length !== 1 ||
    authorizedParties[0] !== dashboardOrigin
  ) {
    throw new Error(
      `CLERK_AUTHORIZED_PARTIES must contain only ${dashboardOrigin} in production`,
    );
  }

  const adminEmails = required(env, 'ADMIN_EMAILS')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (
    adminEmails.length === 0 ||
    adminEmails.some(
      (email) =>
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.endsWith('@example.com'),
    )
  ) {
    throw new Error(
      'ADMIN_EMAILS must contain at least one real production admin email',
    );
  }

  requireExactUrl(env, 'NEXT_PUBLIC_API_BASE_URL', `${dashboardOrigin}/api`);
  requireExactUrl(
    env,
    'GITHUB_CALLBACK_URL',
    `${dashboardOrigin}/github/callback`,
  );
  requireExactUrl(
    env,
    'WEBHOOK_CALLBACK_URL',
    `${dashboardOrigin}/api/webhooks/github`,
  );
  if (required(env, 'NEXT_PUBLIC_SITES_DOMAIN').toLowerCase() !== sitesDomain) {
    throw new Error(
      'NEXT_PUBLIC_SITES_DOMAIN must match SITES_DOMAIN in production',
    );
  }
  if (required(env, 'NEXT_PUBLIC_SITES_SCHEME') !== 'https') {
    throw new Error('NEXT_PUBLIC_SITES_SCHEME must be https in production');
  }

  if (
    !required(env, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY').startsWith('pk_live_')
  ) {
    throw new Error(
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be a Clerk production key',
    );
  }
  if (!required(env, 'CLERK_SECRET_KEY').startsWith('sk_live_')) {
    throw new Error('CLERK_SECRET_KEY must be a Clerk production key');
  }

  required(env, 'GITHUB_CLIENT_ID');
  requireStrongSecret(env, 'GITHUB_CLIENT_SECRET');
  requireStrongSecret(env, 'GITHUB_WEBHOOK_SECRET');

  const databaseUrl = new URL(required(env, 'DATABASE_URL'));
  if (
    !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
    databaseUrl.hostname !== 'postgres' ||
    !databaseUrl.username ||
    !databaseUrl.password
  ) {
    throw new Error(
      'DATABASE_URL must use authenticated PostgreSQL on the private postgres service',
    );
  }
  if (
    Buffer.byteLength(databaseUrl.password, 'utf8') < 24 ||
    INSECURE_SECRET_VALUES.has(databaseUrl.password.toLowerCase())
  ) {
    throw new Error('DATABASE_URL must contain a strong production password');
  }

  const redisUrl = new URL(required(env, 'REDIS_URL'));
  if (
    !['redis:', 'rediss:'].includes(redisUrl.protocol) ||
    redisUrl.hostname !== 'redis' ||
    !redisUrl.password
  ) {
    throw new Error(
      'REDIS_URL must use authenticated Redis on the private redis service',
    );
  }
  if (Buffer.byteLength(redisUrl.password, 'utf8') < 24) {
    throw new Error('REDIS_URL must contain a strong production password');
  }

  if (required(env, 'MINIO_ENDPOINT') !== 'http://minio:9000') {
    throw new Error(
      'MINIO_ENDPOINT must use the private MinIO service in production',
    );
  }
  required(env, 'MINIO_ACCESS_KEY');
  requireStrongSecret(env, 'MINIO_SECRET_KEY');
}
