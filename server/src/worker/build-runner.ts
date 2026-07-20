import * as http from 'node:http';
import {
  chmod,
  lstat,
  readdir,
  readFile,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import * as path from 'node:path';
import execa from 'execa';
import {
  appendBuildLog,
  ensureBuildExchangeDirectories,
  getBuildExchangePaths,
  getBuildExchangeRoot,
  IsolatedBuildRequest,
  IsolatedBuildResult,
} from './build-exchange';
import { validateRelativeDirectory } from './path-security';

const port = Number(process.env.BUILD_RUNNER_HEALTH_PORT || 3002);
const maximumWorkspaceBytes = Math.min(
  Number(process.env.BUILD_MAX_WORKSPACE_BYTES || 1_500_000_000),
  2_000_000_000,
);
const maximumLogBytes = Math.min(
  Number(process.env.BUILD_MAX_LOG_BYTES || 5_000_000),
  10_000_000,
);
const SHARED_EXCHANGE_FILE_MODE = 0o660;

let healthy = true;
let activeBuild = false;

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(healthy ? 200 : 503, {
      'content-type': 'application/json',
    });
    res.end(
      JSON.stringify({
        service: 'isolated-build-runner',
        status: healthy ? 'ok' : 'error',
        activeBuild,
      }),
    );
    return;
  }
  res.writeHead(404).end();
});

async function directorySize(directory: string): Promise<number> {
  let total = 0;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) total += await directorySize(candidate);
    else if (entry.isFile()) total += (await stat(candidate)).size;
    if (total > maximumWorkspaceBytes) return total;
  }
  return total;
}

async function makeWorkspaceRemovable(directory: string): Promise<void> {
  await chmod(directory, 0o777);
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    const metadata = await lstat(candidate);
    if (metadata.isSymbolicLink()) continue;
    if (metadata.isDirectory()) {
      await makeWorkspaceRemovable(candidate);
    } else if (metadata.isFile()) {
      await chmod(candidate, 0o666);
    }
  }
}

function validateRequest(value: unknown): IsolatedBuildRequest {
  const request = value as Partial<IsolatedBuildRequest>;
  if (
    !request ||
    typeof request.id !== 'string' ||
    typeof request.repoUrl !== 'string' ||
    typeof request.branch !== 'string' ||
    typeof request.rootDirectory !== 'string' ||
    typeof request.buildCommand !== 'string'
  ) {
    throw new Error('Invalid isolated build request');
  }
  validateRelativeDirectory(request.rootDirectory, 'Root directory');
  if (
    !/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?$/.test(request.repoUrl)
  ) {
    throw new Error('Build repository must be an HTTPS GitHub repository');
  }
  if (
    !request.branch ||
    request.branch.length > 255 ||
    /[\r\n\0]/.test(request.branch)
  ) {
    throw new Error('Build branch is invalid');
  }
  if (
    !request.buildCommand ||
    request.buildCommand.length > 1_000 ||
    request.buildCommand.includes('\0')
  ) {
    throw new Error('Build command is invalid');
  }
  return request as IsolatedBuildRequest;
}

async function runRequest(request: IsolatedBuildRequest) {
  const paths = getBuildExchangePaths(request.id);
  let writtenLogBytes = 0;
  let workspaceExceeded = false;
  let logLimitNoted = false;
  let diskMonitorErrors = 0;
  const pendingLogWrites = new Set<Promise<void>>();

  const publishLog = async (
    chunk: string | Buffer,
    stream: 'STDOUT' | 'STDERR',
  ) => {
    let text = chunk.toString();
    if (!text) return;
    const remaining = maximumLogBytes - writtenLogBytes;
    if (remaining <= 0) return;
    if (Buffer.byteLength(text) > remaining) {
      text = Buffer.from(text).subarray(0, remaining).toString();
      logLimitNoted = true;
    }
    writtenLogBytes += Buffer.byteLength(text);
    await appendBuildLog(request.id, { stream, text });
  };

  const script =
    'git clone -q -b "$2" --depth 1 "$1" /build/app' +
    ' && cp /build/.env "/build/app/$3/.env"' +
    ' && cd "/build/app/$3"' +
    ' && npm install --ignore-scripts --no-fund --no-audit --loglevel=error' +
    ' && /bin/sh -c "$4"';

  const child = execa('nsjail', [
    '-q',
    '-Mo',
    '--chroot',
    '',
    '--disable_proc',
    '--bindmount_ro',
    '/proc',
    '--bindmount_ro',
    '/bin',
    '--bindmount_ro',
    '/lib',
    '--bindmount_ro',
    '/usr',
    '--bindmount_ro',
    '/etc',
    '--bindmount_ro',
    '/lib64',
    '--bindmount',
    '/dev',
    '--bindmount',
    `${paths.workDirectory}:/build`,
    '--user',
    '99999',
    '--group',
    '99999',
    '--time_limit',
    '300',
    '--rlimit_cpu',
    '300',
    '--rlimit_as',
    'inf',
    '--rlimit_nofile',
    '4096',
    '--rlimit_fsize',
    '256',
    '--rlimit_nproc',
    '512',
    // Docker already provides the outer user boundary. Dropping directly to
    // UID 99999 makes the owner-based egress firewall apply to the real payload
    // instead of mapping jail-root back to container-root.
    '--disable_clone_newuser',
    '--disable_clone_newnet',
    '--env',
    'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    '--env',
    'HOME=/build',
    '--',
    '/bin/sh',
    '-c',
    script,
    '--',
    request.repoUrl,
    request.branch,
    request.rootDirectory,
    request.buildCommand,
  ]);

  child.stdout?.on('data', (chunk: Buffer) => {
    const write = publishLog(chunk, 'STDOUT').finally(() =>
      pendingLogWrites.delete(write),
    );
    pendingLogWrites.add(write);
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    const write = publishLog(chunk, 'STDERR').finally(() =>
      pendingLogWrites.delete(write),
    );
    pendingLogWrites.add(write);
  });

  const diskMonitor = setInterval(() => {
    void directorySize(paths.workDirectory)
      .then((size) => {
        diskMonitorErrors = 0;
        if (size > maximumWorkspaceBytes) {
          workspaceExceeded = true;
          child.kill('SIGKILL');
        }
      })
      .catch(() => {
        // Files can disappear while npm atomically renames its cache entries.
        // Only fail closed after repeated scans cannot inspect the workspace.
        diskMonitorErrors += 1;
        if (diskMonitorErrors >= 10) child.kill('SIGKILL');
      });
  }, 1_000);

  try {
    await child;
  } catch (error) {
    if (workspaceExceeded)
      throw new Error('Build workspace exceeded the 1.5 GB limit');
    throw error;
  } finally {
    clearInterval(diskMonitor);
    await Promise.allSettled([...pendingLogWrites]);
    await makeWorkspaceRemovable(paths.workDirectory);
  }
  if (workspaceExceeded) {
    throw new Error('Build workspace exceeded the 1.5 GB limit');
  }
  if (logLimitNoted) {
    await appendBuildLog(request.id, {
      stream: 'STDERR',
      text: '\nBuild log was truncated at the 5 MB security limit.\n',
    });
  }
}

async function processQueuedRequest(fileName: string) {
  if (!/^[0-9a-f-]{36}\.json$/i.test(fileName)) return;
  const requestId = fileName.slice(0, -5);
  const paths = getBuildExchangePaths(requestId);
  await rename(paths.queuedRequest, paths.runningRequest);
  let result: IsolatedBuildResult;
  try {
    const request = validateRequest(
      JSON.parse(await readFile(paths.runningRequest, 'utf8')),
    );
    activeBuild = true;
    await runRequest(request);
    result = { ok: true };
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : 'Isolated build failed',
    };
  } finally {
    activeBuild = false;
  }
  await writeFile(paths.resultFile, JSON.stringify(result), {
    encoding: 'utf8',
    mode: SHARED_EXCHANGE_FILE_MODE,
  });
}

async function runLoop() {
  await ensureBuildExchangeDirectories();
  const queueDirectory = path.join(getBuildExchangeRoot(), 'queue');
  while (healthy) {
    const queued = (await readdir(queueDirectory))
      .filter((file) => file.endsWith('.json'))
      .sort();
    if (queued[0]) {
      await processQueuedRequest(queued[0]);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

healthServer.listen(port, '0.0.0.0', () => {
  console.log(`[build-runner] health endpoint listening on :${port}`);
});

runLoop()
  .then(() => {
    // Compose restarts this read-only runner after every request, giving each
    // repository a fresh process, mount, PID, and network namespace lifecycle.
    healthServer.close(() => process.exit(0));
  })
  .catch((error) => {
    healthy = false;
    console.error('[build-runner] fatal error:', error);
    healthServer.close(() => process.exit(1));
  });
