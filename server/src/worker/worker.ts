import * as http from 'node:http';
import { Worker, Job } from 'bullmq';
import execa from 'execa';
import * as fs from 'fs-extra';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { uploadDirectory } from './minio';
import { decrypt } from '../utils/crypto.util';

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
  const { deploymentId, repoUrl, branch } = job.data;
  console.log(`[worker] Processing deploy ${deploymentId} for ${repoUrl} (branch: ${branch})`);

  const deployment = await prisma.deployment.update({
    where: { id: deploymentId },
    data: { status: 'BUILDING' },
    include: { project: true }
  });

  const buildDir = `/tmp/builds/${deploymentId}`;
  await fs.ensureDir(buildDir);

  let logSequence = 0;
  const publishLog = (chunk: string | Buffer, stream: 'STDOUT' | 'STDERR') => {
    let text = chunk.toString();
    
    if (stream === 'STDERR') {
      const lines = text.split('\n');
      const filtered = lines.filter(l => 
        !l.includes('UID/EUID=0 in the global user namespace') && 
        !l.includes('GID/EGID=0 in the global user namespace') &&
        !l.includes('npm notice')
      );
      text = filtered.join('\n');
      if (!text.trim()) return;
    }

    console.log(`[${deploymentId}] [${stream}] ${text.trim()}`);
    redis.publish(`deploy:${deploymentId}`, JSON.stringify({ stream, text }));
    const currentSeq = logSequence++;
    prisma.deploymentLogChunk.create({
      data: {
        deploymentId,
        sequence: currentSeq,
        content: text,
        stream
      }
    }).catch(err => console.error(`[worker] failed to save log chunk:`, err.message));
  };

  try {
    const rootDir = deployment.project.rootDirectory || './';
    const buildCmd = deployment.project.buildCommand || 'npm run build';
    
    const envVars = await prisma.environmentVariable.findMany({
      where: { projectId: deployment.projectId }
    });
    
    let envString = '';
    for (const v of envVars) {
      envString += `${v.key}=${decrypt(v.encryptedValue, v.iv)}\n`;
    }
    await fs.writeFile(require('path').join(buildDir, '.env'), envString);

    const script = `git clone -q -b "$2" --depth 1 "$1" /build/app && cp /build/.env /build/app/${rootDir}/.env && cd /build/app/${rootDir} && npm install --ignore-scripts --no-fund --no-audit --loglevel=error && ${buildCmd}`;

    const nsjailProcess = execa('nsjail', [
        '-q', // quiet mode
        '-Mo', // Mount proc/sys and run once
        '--chroot', '', // Let nsjail create an empty chroot internally
        '--disable_proc', // Docker masks /proc, so disable nsjail procfs mount
        '--bindmount_ro', '/proc', // Bind-mount the container's existing /proc
        '--bindmount_ro', '/bin',
        '--bindmount_ro', '/lib',
        '--bindmount_ro', '/usr',
        '--bindmount_ro', '/etc',
        '--bindmount_ro', '/lib64',
        '--bindmount', '/dev',
        '--bindmount', `${buildDir}:/build`, // Mount only the build dir read-write
        '--user', '99999', '--group', '99999', // Run as nobody
        '--time_limit', '300', // 5 minute max
        '--rlimit_as', 'inf', // Disable virtual memory limit for WASM
        '--rlimit_nofile', '4096', // Max 4096 open files (npm needs this)
        '--rlimit_fsize', '1024', // 1GB max file size
        '--rlimit_nproc', '512', // Max processes
        '--disable_clone_newnet', // allow internet access
        '--env', 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        '--env', 'HOME=/build', // npm needs a writable home
        '--',
        '/bin/sh', '-c',
        script,
        '--', repoUrl, branch || 'main'
      ]);
      nsjailProcess.stdout?.on('data', (chunk: any) => publishLog(chunk || '', 'STDOUT'));
      nsjailProcess.stderr?.on('data', (chunk: any) => publishLog(chunk || '', 'STDERR'));
      await nsjailProcess;
    
    publishLog('Starting upload...\n', 'STDOUT');
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'UPLOADING' }
    });

    const outDir = deployment.project.outputDirectory || 'dist';
    // Path resolution handles `./` smoothly
    const distDir = require('path').join(buildDir, 'app', rootDir, outDir);
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
    
    // Create notification
    await prisma.notification.create({
      data: {
        userId: deployment.project.userId,
        title: 'Deployment successful',
        message: `${deployment.project.name} is now live (branch: ${deployment.branch})`,
        type: 'SUCCESS'
      }
    });

  } catch (err: any) {
    publishLog(`Build failed: ${err.message}\n`, 'STDERR');
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'FAILED' }
    });
    
    // Create notification
    await prisma.notification.create({
      data: {
        userId: deployment.project.userId,
        title: 'Deployment failed',
        message: `${deployment.project.name} failed to build (branch: ${deployment.branch})`,
        type: 'ERROR'
      }
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
