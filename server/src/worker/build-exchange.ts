import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  access,
  appendFile,
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import * as path from 'node:path';

export type BuildStream = 'STDOUT' | 'STDERR';

export interface IsolatedBuildRequest {
  id: string;
  repoUrl: string;
  branch: string;
  rootDirectory: string;
  buildCommand: string;
}

export interface IsolatedBuildResult {
  ok: boolean;
  error?: string;
}

export interface BuildLogEvent {
  stream: BuildStream;
  text: string;
}

const pollIntervalMs = 200;
const SHARED_EXCHANGE_FILE_MODE = 0o660;

export function getBuildExchangeRoot() {
  return path.resolve(
    process.env.BUILD_EXCHANGE_ROOT || '/var/lib/kyte-builds',
  );
}

function assertRequestId(requestId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
    throw new Error('Invalid isolated build request ID');
  }
}

export function getBuildExchangePaths(requestId: string) {
  assertRequestId(requestId);
  const root = getBuildExchangeRoot();
  return {
    root,
    queueDirectory: path.join(root, 'queue'),
    runningDirectory: path.join(root, 'running'),
    workDirectory: path.join(root, 'work', requestId),
    logsDirectory: path.join(root, 'logs'),
    resultsDirectory: path.join(root, 'results'),
    pendingRequest: path.join(root, 'queue', `${requestId}.pending`),
    queuedRequest: path.join(root, 'queue', `${requestId}.json`),
    runningRequest: path.join(root, 'running', `${requestId}.json`),
    logFile: path.join(root, 'logs', `${requestId}.jsonl`),
    resultFile: path.join(root, 'results', `${requestId}.json`),
  };
}

export async function ensureBuildExchangeDirectories() {
  const root = getBuildExchangeRoot();
  await Promise.all(
    ['queue', 'running', 'work', 'logs', 'results'].map((directory) =>
      mkdir(path.join(root, directory), { recursive: true }),
    ),
  );
}

export async function createIsolatedBuild(
  input: Omit<IsolatedBuildRequest, 'id'>,
  environmentContents: string,
) {
  const request: IsolatedBuildRequest = { ...input, id: randomUUID() };
  const paths = getBuildExchangePaths(request.id);
  await ensureBuildExchangeDirectories();
  await mkdir(paths.workDirectory, { recursive: false });

  const environmentFile = path.join(paths.workDirectory, '.env');
  await writeFile(environmentFile, environmentContents, {
    encoding: 'utf8',
    mode: 0o644,
  });
  // nsjail may map the payload UID through a user namespace. This directory is
  // the only exchange path mounted into that jail, so namespace-compatible
  // permissions do not expose queue metadata, results, logs, or other builds.
  await chmod(paths.workDirectory, 0o777);

  await writeFile(paths.pendingRequest, JSON.stringify(request), {
    encoding: 'utf8',
    mode: SHARED_EXCHANGE_FILE_MODE,
  });
  await rename(paths.pendingRequest, paths.queuedRequest);
  return request;
}

export async function appendBuildLog(requestId: string, event: BuildLogEvent) {
  const { logFile } = getBuildExchangePaths(requestId);
  await appendFile(logFile, `${JSON.stringify(event)}\n`, {
    encoding: 'utf8',
    mode: SHARED_EXCHANGE_FILE_MODE,
  });
}

async function exists(file: string) {
  try {
    await access(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function waitForIsolatedBuild(
  requestId: string,
  onLog: (event: BuildLogEvent) => void,
  timeoutMs = 320_000,
) {
  const paths = getBuildExchangePaths(requestId);
  const startedAt = Date.now();
  let consumedLogLength = 0;
  let incompleteLine = '';

  const consumeLogs = async () => {
    if (!(await exists(paths.logFile))) return;
    const contents = await readFile(paths.logFile, 'utf8');
    if (contents.length < consumedLogLength) {
      throw new Error('Isolated build log was unexpectedly truncated');
    }
    const nextChunk = contents.slice(consumedLogLength);
    consumedLogLength = contents.length;
    const lines = `${incompleteLine}${nextChunk}`.split('\n');
    incompleteLine = lines.pop() || '';
    for (const line of lines) {
      if (!line) continue;
      const event = JSON.parse(line) as BuildLogEvent;
      if (
        (event.stream !== 'STDOUT' && event.stream !== 'STDERR') ||
        typeof event.text !== 'string'
      ) {
        throw new Error('Isolated build returned an invalid log event');
      }
      onLog(event);
    }
  };

  while (Date.now() - startedAt < timeoutMs) {
    await consumeLogs();
    if (await exists(paths.resultFile)) {
      const result = JSON.parse(
        await readFile(paths.resultFile, 'utf8'),
      ) as IsolatedBuildResult;
      await consumeLogs();
      if (typeof result.ok !== 'boolean') {
        throw new Error('Isolated build returned an invalid result');
      }
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('Isolated build runner did not finish within the time limit');
}

export async function cleanupIsolatedBuild(requestId: string) {
  const paths = getBuildExchangePaths(requestId);
  await Promise.all([
    rm(paths.pendingRequest, { force: true }),
    rm(paths.queuedRequest, { force: true }),
    rm(paths.runningRequest, { force: true }),
    rm(paths.logFile, { force: true }),
    rm(paths.resultFile, { force: true }),
    rm(paths.workDirectory, { recursive: true, force: true }),
  ]);
}
