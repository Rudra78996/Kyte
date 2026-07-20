import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { assertProductionConfiguration } from '../src/common/production-config';
import { assertEncryptionConfigured } from '../src/utils/crypto.util';
import { assertWebhookSecretConfigured } from '../src/webhooks/webhook-config';

const serverRoot = resolve(__dirname, '..');
const repositoryRoot = resolve(serverRoot, '..');
const envFile = resolve(serverRoot, process.argv[2] ?? '../.env.production');
const failures: string[] = [];

function fail(message: string) {
  failures.push(message);
}

function run(command: string, args: string[]) {
  return execFileSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

if (!existsSync(envFile)) {
  fail(`Production environment file not found: ${envFile}`);
} else {
  const mode = statSync(envFile).mode & 0o777;
  if ((mode & 0o077) !== 0) {
    fail(
      'Production environment file must be readable and writable only by its owner (chmod 600)',
    );
  }
  loadEnvFile(envFile);
}

if (process.env.NODE_ENV !== 'production') {
  fail('NODE_ENV must be production');
}
if (
  !/^[a-zA-Z0-9][a-zA-Z0-9._-]{6,127}$/.test(
    process.env.RELEASE_VERSION ?? '',
  ) ||
  ['latest', 'local'].includes(process.env.RELEASE_VERSION?.toLowerCase() ?? '')
) {
  fail(
    'RELEASE_VERSION must be an immutable release identifier, such as the reviewed Git commit SHA',
  );
}

for (const [name, description] of [
  [
    'PRODUCTION_CREDENTIALS_ROTATED',
    'all old provider and infrastructure credentials have been rotated',
  ],
  [
    'GITHUB_STORED_TOKENS_REVOKED',
    'old stored GitHub tokens have been revoked and accounts reconnected',
  ],
  [
    'LOCAL_SECURITY_TESTS_PASSED',
    'the complete local security test gate has passed',
  ],
] as const) {
  if (process.env[name]?.toLowerCase() !== 'true') {
    fail(`${name}=true is required only after confirming that ${description}`);
  }
}

try {
  assertEncryptionConfigured();
  assertWebhookSecretConfigured();
  assertProductionConfiguration();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const infrastructureSecrets = [
  'ENCRYPTION_KEY',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_WEBHOOK_SECRET',
  'POSTGRES_PASSWORD',
  'REDIS_PASSWORD',
  'MINIO_ROOT_PASSWORD',
  'MINIO_SECRET_KEY',
] as const;
const configuredSecrets: Array<readonly [string, string]> = [];
for (const name of infrastructureSecrets) {
  const value = process.env[name]?.trim();
  if (value) {
    configuredSecrets.push([name, value]);
  }
}
for (let index = 0; index < configuredSecrets.length; index++) {
  for (let other = index + 1; other < configuredSecrets.length; other++) {
    if (configuredSecrets[index][1] === configuredSecrets[other][1]) {
      fail(
        `${configuredSecrets[index][0]} and ${configuredSecrets[other][0]} must use independent secrets`,
      );
    }
  }
}

try {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  if (databaseUrl.username !== process.env.POSTGRES_USER) {
    fail('DATABASE_URL username must match POSTGRES_USER');
  }
  if (databaseUrl.password !== process.env.POSTGRES_PASSWORD) {
    fail('DATABASE_URL password must match POSTGRES_PASSWORD');
  }
  if (databaseUrl.pathname.slice(1) !== process.env.POSTGRES_DB) {
    fail('DATABASE_URL database must match POSTGRES_DB');
  }
} catch {
  // The production configuration validator reports the malformed URL.
}

try {
  const redisUrl = new URL(process.env.REDIS_URL ?? '');
  if (redisUrl.password !== process.env.REDIS_PASSWORD) {
    fail('REDIS_URL password must match REDIS_PASSWORD');
  }
} catch {
  // The production configuration validator reports the malformed URL.
}

if (process.env.MINIO_ROOT_USER === process.env.MINIO_ACCESS_KEY) {
  fail('MINIO_ROOT_USER and MINIO_ACCESS_KEY must be different identities');
}
if (process.env.MINIO_BUCKET !== 'deployly-projects') {
  fail('MINIO_BUCKET must be deployly-projects to match the restricted policy');
}

try {
  const trackedSensitiveFiles = run('git', ['ls-files'])
    .split('\n')
    .filter(Boolean)
    .filter(
      (file) => /(^|\/)\.env(?:\.|$)/.test(file) && file !== '.env.example',
    );
  if (trackedSensitiveFiles.length > 0) {
    fail(
      `Environment files are tracked by Git: ${trackedSensitiveFiles.join(', ')}`,
    );
  }
} catch (error) {
  fail(`Could not inspect tracked files: ${String(error)}`);
}

const bypassPattern =
  /E2E_BYPASS|AUTH_BYPASS|SKIP_AUTH|x-e2e|e2e-bypass|mock-session/i;
const sourceRoots = [
  resolve(repositoryRoot, 'server/src'),
  resolve(repositoryRoot, 'web/app'),
  resolve(repositoryRoot, 'web/components'),
  resolve(repositoryRoot, 'web/lib'),
  resolve(repositoryRoot, 'web/proxy.ts'),
];
const sourceFiles: string[] = [];
function collectSourceFiles(path: string) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      collectSourceFiles(resolve(path, entry));
    }
    return;
  }
  if (/\.(?:js|jsx|mjs|ts|tsx)$/.test(path)) {
    sourceFiles.push(path);
  }
}
for (const sourceRoot of sourceRoots) {
  collectSourceFiles(sourceRoot);
}
for (const sourceFile of sourceFiles) {
  if (bypassPattern.test(readFileSync(sourceFile, 'utf8'))) {
    fail(
      `Authentication bypass marker found in ${sourceFile.slice(repositoryRoot.length + 1)}`,
    );
  }
}

try {
  run('docker', [
    'compose',
    '--env-file',
    envFile,
    '-f',
    'docker-compose.yml',
    '-f',
    'docker-compose.host-caddy.yml',
    'config',
    '--quiet',
  ]);
} catch (error) {
  fail(`Production Compose configuration is invalid: ${String(error)}`);
}

if (failures.length > 0) {
  console.error('Production security preflight FAILED:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    'Production security preflight PASSED: environment, attestations, source scan, and Compose configuration are valid.',
  );
}
