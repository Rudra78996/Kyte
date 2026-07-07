import * as http from 'node:http';
import { Worker, Job } from 'bullmq';
import execa from 'execa';
import * as fs from 'fs-extra';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { uploadDirectory } from './minio';

const port = Number(process.env.WORKER_PORT ?? 3001);

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
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

const worker = new Worker('builds', async (job: Job) => {
  const { deploymentId, repoUrl } = job.data;
  console.log(`[worker] Processing deploy ${deploymentId} for ${repoUrl}`);

  const deployment = await prisma.deployment.update({
    where: { id: deploymentId },
    data: { status: 'BUILDING' }
  });

  const buildDir = `/tmp/builds/${deploymentId}`;
  await fs.ensureDir(buildDir);

  const publishLog = (chunk: string | Buffer, stream: 'STDOUT' | 'STDERR') => {
    const text = chunk.toString();
    console.log(`[${deploymentId}] [${stream}] ${text.trim()}`);
    redis.publish(`deploy:${deploymentId}`, JSON.stringify({ stream, text }));
  };

  try {
    const runNsjail = true;
    
    if (runNsjail) {
      const nsjailProcess = execa('nsjail', [
        '-Mo', // Mount proc/sys and run once
        '--chroot', '/', // Don't chroot into an empty dir, use the container's root
        '--bindmount_ro', '/', // Mount the whole filesystem read-only
        '--bindmount', `${buildDir}:/build`, // Mount only the build dir read-write
        '--user', '99999', '--group', '99999', // Run as nobody
        '--time_limit', '300', // 5 minute max
        '--rlimit_as', 'inf', // Allow Node.js/WASM to map virtual memory
        '--rlimit_nofile', '4096', // Max 4096 open files (npm needs this)
        '--rlimit_fsize', 'inf', // Allow creating large files (e.g. node_modules/ build output)
        '--disable_clone_newnet', // allow internet access
        '--env', 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        '--env', 'HOME=/build', // npm needs a writable home
        '--',
        '/bin/sh', '-c',
        `git clone --depth 1 ${repoUrl} /build/app && cd /build/app && npm install --ignore-scripts && npm run build`
      ], {
        all: true
      });
      nsjailProcess.all?.on('data', (chunk: any) => publishLog(chunk || '', 'STDOUT'));
      await nsjailProcess;
    } else {
      publishLog('Starting clone...\n', 'STDOUT');
      const clone = execa('git', ['clone', '--depth', '1', repoUrl, `${buildDir}/app`]);
      clone.stdout?.on('data', (c: any) => publishLog(c, 'STDOUT'));
      clone.stderr?.on('data', (c: any) => publishLog(c, 'STDERR'));
      await clone;

      publishLog('Starting install...\n', 'STDOUT');
      const install = execa('npm', ['install', '--ignore-scripts'], { cwd: `${buildDir}/app` });
      install.stdout?.on('data', (c: any) => publishLog(c, 'STDOUT'));
      install.stderr?.on('data', (c: any) => publishLog(c, 'STDERR'));
      await install;

      publishLog('Starting build...\n', 'STDOUT');
      const build = execa('npm', ['run', 'build'], { cwd: `${buildDir}/app` });
      build.stdout?.on('data', (c: any) => publishLog(c, 'STDOUT'));
      build.stderr?.on('data', (c: any) => publishLog(c, 'STDERR'));
      await build;
    }
    
    publishLog('Starting upload...\n', 'STDOUT');
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'UPLOADING' }
    });

    const distDir = `${buildDir}/app/dist`;
    await uploadDirectory(deployment.s3Prefix, distDir, (msg) => publishLog(msg + '\n', 'STDOUT'));

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'SUCCESS' }
    });
    publishLog('Deploy complete.\n', 'STDOUT');

    // Update Project active deployment
    await prisma.project.update({
      where: { id: deployment.projectId },
      data: { activeDeployId: deploymentId }
    });

  } catch (err: any) {
    publishLog(`Build failed: ${err.message}\n`, 'STDERR');
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'FAILED' }
    });
  } finally {
    await fs.remove(buildDir).catch(() => {});
  }
}, {
  connection: { url: redisUrl }
});

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err);
});
