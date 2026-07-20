import { readFileSync } from 'node:fs';
import * as path from 'node:path';

const repositoryRoot = path.resolve(__dirname, '../../..');
const compose = readFileSync(
  path.join(repositoryRoot, 'docker-compose.yml'),
  'utf8',
);
const caddy = readFileSync(path.join(repositoryRoot, 'Caddyfile'), 'utf8');
const buildRunner = readFileSync(
  path.join(repositoryRoot, 'server/src/worker/build-runner.ts'),
  'utf8',
);
const buildExchange = readFileSync(
  path.join(repositoryRoot, 'server/src/worker/build-exchange.ts'),
  'utf8',
);

describe('Phase 2 infrastructure boundaries', () => {
  it('keeps the isolated runner off every internal service network', () => {
    const runnerBlock = compose
      .split('\n  build-runner:')[1]
      .split('\n  redis:')[0];

    expect(runnerBlock).toContain('- build-egress-net');
    expect(runnerBlock).not.toContain('- app-net');
    expect(runnerBlock).not.toContain('- worker-net');
    expect(runnerBlock).not.toContain('env_file:');
    expect(runnerBlock).not.toContain('/var/run/docker.sock');
    expect(runnerBlock).toContain('read_only: true');
    expect(runnerBlock).toContain('restart: unless-stopped');
    expect(runnerBlock).toContain('group_add:');
    expect(runnerBlock).toContain('- "1000"');
    expect(runnerBlock).toContain('- SETPCAP');
    expect(runnerBlock).toContain('- SETUID');
    expect(runnerBlock).toContain('- SETGID');
    expect(runnerBlock).toContain('- FOWNER');
    expect(runnerBlock).not.toContain('DAC_OVERRIDE');
    expect(runnerBlock).toContain('mem_limit: 1536m');
    expect(runnerBlock).toContain('pids_limit: 600');
  });

  it('uses a least-privilege shared group for build exchange files', () => {
    const storageInitBlock = compose
      .split('\n  storage-init:')[1]
      .split('\n  web:')[0];

    expect(storageInitBlock).toContain(
      'chmod 2770 /builds/queue /builds/running /builds/logs /builds/results',
    );
    expect(storageInitBlock).toContain('chmod 2771 /builds/work');
    expect(storageInitBlock).toContain('chmod 2771 /builds');
    expect(storageInitBlock).toContain('-type f -exec chmod 0660 {} +');
    expect(storageInitBlock).toContain('group_add:');
    expect(storageInitBlock).toContain('- "1000"');
    expect(
      buildExchange.match(/mode: SHARED_EXCHANGE_FILE_MODE/g),
    ).toHaveLength(2);
    expect(buildRunner).toContain('mode: SHARED_EXCHANGE_FILE_MODE');
  });

  it('exits after a fatal runner-loop error so Compose can restart it', () => {
    expect(buildRunner).toContain('healthServer.close(() => process.exit(1))');
  });

  it('does not grant sandbox capabilities to the trusted queue worker', () => {
    const workerBlock = compose
      .split('\n  worker:')[1]
      .split('\n  build-runner:')[0];

    expect(workerBlock).not.toContain('SYS_ADMIN');
    expect(workerBlock).not.toContain('NET_ADMIN');
    expect(workerBlock).not.toContain('seccomp:unconfined');
  });

  it('drops the real jailed payload to the firewall-controlled UID', () => {
    expect(buildRunner).toContain("'--user',\n    '99999'");
    expect(buildRunner).toContain("'--disable_clone_newuser'");
    expect(buildRunner).toContain("'--disable_clone_newnet'");
    expect(buildRunner).toContain(
      'await makeWorkspaceRemovable(paths.workDirectory)',
    );
  });

  it('blocks deployment-serving API paths on the dashboard host', () => {
    const dashboardBlock = caddy.split('http://localhost {')[1].split('\n}')[0];

    expect(dashboardBlock).toContain(
      '@deployment_api path /api/serve /api/serve/*',
    );
    expect(dashboardBlock).toContain('handle @deployment_api');
    expect(dashboardBlock).toContain('respond 404');
    expect(caddy).toContain('http://*.sites.localhost');
    expect(caddy).not.toContain('http://*.localhost {');
  });
});
