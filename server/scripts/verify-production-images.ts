import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

const serverRoot = resolve(__dirname, '..');
const envFile = resolve(serverRoot, process.argv[2] ?? '../.env.production');
if (!existsSync(envFile)) {
  throw new Error(`Production environment file not found: ${envFile}`);
}
loadEnvFile(envFile);

const release = process.env.RELEASE_VERSION;
if (!release || ['latest', 'local'].includes(release.toLowerCase())) {
  throw new Error('RELEASE_VERSION must identify the reviewed release');
}

const images = [
  `kyte-api:${release}`,
  `kyte-worker:${release}`,
  `kyte-build-runner:${release}`,
  `kyte-web:${release}`,
  `kyte-minio:${release}`,
];
const bypassPattern =
  'E2E_BYPASS|AUTH_BYPASS|SKIP_AUTH|x-e2e|e2e-bypass|mock-session';

for (const image of images) {
  const revision = execFileSync(
    'docker',
    [
      'image',
      'inspect',
      '--format',
      '{{ index .Config.Labels "org.opencontainers.image.revision" }}',
      image,
    ],
    { encoding: 'utf8' },
  ).trim();
  if (revision !== release) {
    throw new Error(
      `${image} has revision ${revision || '<missing>'}, expected ${release}`,
    );
  }

  execFileSync(
    'docker',
    [
      'run',
      '--rm',
      '--entrypoint',
      'sh',
      image,
      '-c',
      `test -z "$(find /app -type f -name '.env*' -print -quit 2>/dev/null)" && test ! -d /app/src && test ! -d /app/tests && test ! -d /app/node_modules/jest && ! find /app/dist /app/.next -type f -exec grep -IlE '${bypassPattern}' {} + 2>/dev/null | grep -q .`,
    ],
    { stdio: 'ignore' },
  );
  console.log(`Verified ${image}`);
}

console.log(
  'Production image verification PASSED: immutable revision labels match, no environment files are present, and no authentication bypass markers were found.',
);
