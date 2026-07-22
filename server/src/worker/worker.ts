import * as http from 'node:http';
import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { uploadDirectory } from './minio';
import { assertEncryptionConfigured, decrypt } from '../utils/crypto.util';
import * as path from 'node:path';
import {
  cleanupIsolatedBuild,
  createIsolatedBuild,
  waitForIsolatedBuild,
} from './build-exchange';
import { requireAuthenticatedRedisUrl } from '../common/runtime-config';
import {
  resolveExistingDirectoryWithin,
  resolvePathWithin,
  validateRelativeDirectory,
} from './path-security';

const port = Number(process.env.WORKER_PORT ?? 3001);

assertEncryptionConfigured();
const prisma = new PrismaClient();
const redisUrl = requireAuthenticatedRedisUrl();
const redis = new Redis(redisUrl);

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ service: 'worker', status: 'ok' }));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[worker] listening on :${port}`);
});

const worker = new Worker(
  'builds',
  async (job: Job) => {
    const deploymentId = job.data?.deploymentId;
    if (typeof deploymentId !== 'string' || !deploymentId) {
      throw new Error('Build job is missing a valid deployment ID');
    }

    const queuedDeployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { project: true },
    });
    if (!queuedDeployment) {
      throw new Error('Deployment not found');
    }
    if (queuedDeployment.status === 'CANCELED') {
      console.log(`[worker] Skipping canceled deploy ${deploymentId}`);
      return;
    }
    const deployment = await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'BUILDING' },
      include: { project: true },
    });
    const { repoUrl, branch } = deployment;
    console.log(
      `[worker] Processing deploy ${deploymentId} for ${repoUrl} (branch: ${branch})`,
    );

    let isolatedBuildId: string | undefined;

    let logSequence = 0;
    const publishLog = (
      chunk: string | Buffer,
      stream: 'STDOUT' | 'STDERR',
    ) => {
      let text = chunk.toString();

      if (stream === 'STDERR') {
        const lines = text.split('\n');
        const filtered = lines.filter(
          (l) =>
            !l.includes('UID/EUID=0 in the global user namespace') &&
            !l.includes('GID/EGID=0 in the global user namespace') &&
            !l.includes('npm notice'),
        );
        text = filtered.join('\n');
        if (!text.trim()) return;
      }

      console.log(`[${deploymentId}] [${stream}] ${text.trim()}`);
      redis.publish(`deploy:${deploymentId}`, JSON.stringify({ stream, text }));
      const currentSeq = logSequence++;
      prisma.deploymentLogChunk
        .create({
          data: {
            deploymentId,
            sequence: currentSeq,
            content: text,
            stream,
          },
        })
        .catch((err) =>
          console.error(`[worker] failed to save log chunk:`, err.message),
        );
    };

    try {
      const rootDir = validateRelativeDirectory(
        deployment.project.rootDirectory || './',
        'Root directory',
      );
      const outDir = validateRelativeDirectory(
        deployment.project.outputDirectory || 'dist',
        'Output directory',
        false,
      );
      const buildCmd = deployment.project.buildCommand || 'npm run build';

      const envVars = await prisma.environmentVariable.findMany({
        where: { projectId: deployment.projectId },
      });

      let envString = '';
      for (const v of envVars) {
        envString += `${v.key}=${decrypt(v.encryptedValue, v.iv, v.authTag)}\n`;
      }
      const isolatedBuild = await createIsolatedBuild(
        {
          repoUrl,
          branch: branch || 'main',
          rootDirectory: rootDir,
          buildCommand: buildCmd,
        },
        envString,
      );
      isolatedBuildId = isolatedBuild.id;
      const buildResult = await waitForIsolatedBuild(
        isolatedBuild.id,
        ({ stream, text }) => publishLog(text, stream),
      );
      if (!buildResult.ok) {
        throw new Error(buildResult.error || 'Isolated build failed');
      }

      const afterBuild = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { status: true },
      });
      if (afterBuild?.status === 'CANCELED') {
        publishLog('Deployment canceled by administrator.\n', 'STDOUT');
        return;
      }

      publishLog('Starting upload...\n', 'STDOUT');
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'UPLOADING' },
      });

      const appDir = path.resolve(
        process.env.BUILD_EXCHANGE_ROOT || '/var/lib/kyte-builds',
        'work',
        isolatedBuild.id,
        'app',
      );
      const projectDir = resolvePathWithin(appDir, rootDir, 'Root directory');
      const realProjectDir = await resolveExistingDirectoryWithin(
        appDir,
        projectDir,
        'Root directory',
      );
      const outputCandidate = resolvePathWithin(
        realProjectDir,
        outDir,
        'Output directory',
      );
      const distDir = await resolveExistingDirectoryWithin(
        realProjectDir,
        outputCandidate,
        'Output directory',
      );

      await uploadDirectory(deployment.s3Prefix, distDir, (msg) =>
        publishLog(msg + '\n', 'STDOUT'),
      );

      const beforeSuccess = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { status: true },
      });
      if (beforeSuccess?.status === 'CANCELED') {
        publishLog('Deployment canceled by administrator.\n', 'STDOUT');
        return;
      }

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'SUCCESS' },
      });
      publishLog('Deploy complete.\n', 'STDOUT');

      // Update Project active deployment
      await prisma.project.update({
        where: { id: deployment.projectId },
        data: { activeDeployId: deploymentId },
      });
    } catch (err: any) {
      const currentDeployment = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { status: true },
      });
      if (currentDeployment?.status === 'CANCELED') {
        publishLog('Deployment canceled by administrator.\n', 'STDOUT');
        return;
      }
      publishLog(`Build failed: ${err.message}\n`, 'STDERR');
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'FAILED' },
      });
    } finally {
      if (isolatedBuildId) {
        await cleanupIsolatedBuild(isolatedBuildId).catch(() => {});
      }
    }
  },
  {
    connection: { url: redisUrl },
    concurrency: 2,
  },
);

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err);
});
