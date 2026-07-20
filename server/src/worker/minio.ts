import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as mime from 'mime-types';
import { createReadStream } from 'node:fs';
import { requireEnvironment } from '../common/runtime-config';

const endpoint = requireEnvironment('MINIO_ENDPOINT');
const accessKeyId = requireEnvironment('MINIO_ACCESS_KEY');
const secretAccessKey = requireEnvironment('MINIO_SECRET_KEY');
const bucket = requireEnvironment('MINIO_BUCKET');

const s3 = new S3Client({
  endpoint,
  region: 'us-east-1',
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err: any) {
    if (err.$metadata?.httpStatusCode === 404) {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log(`[worker] Created bucket ${bucket}`);
    } else {
      console.error(`[worker] Failed to check bucket:`, err);
    }
  }
}

export const MAX_UPLOAD_FILES = 10_000;
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

interface UploadFile {
  path: string;
  size: number;
}

async function* getFiles(dir: string): AsyncGenerator<UploadFile> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isSymbolicLink()) {
      continue; // Skip symlinks to prevent arbitrary file read
    }
    if (dirent.isDirectory()) {
      yield* getFiles(res);
    } else if (dirent.isFile()) {
      const fileStat = await fs.lstat(res);
      yield { path: res, size: fileStat.size };
    }
  }
}

export async function uploadDirectory(prefix: string, dir: string, onProgress?: (msg: string) => void) {
  if (!(await fs.pathExists(dir))) {
    throw new Error(`Directory ${dir} does not exist to upload`);
  }

  const files: UploadFile[] = [];
  let totalBytes = 0;
  for await (const file of getFiles(dir)) {
    files.push(file);
    totalBytes += file.size;
    if (files.length > MAX_UPLOAD_FILES) {
      throw new Error(
        `Deployment output exceeds the ${MAX_UPLOAD_FILES.toLocaleString()} file limit`,
      );
    }
    if (totalBytes > MAX_UPLOAD_BYTES) {
      throw new Error('Deployment output exceeds the 100 MB upload limit');
    }
  }

  await ensureBucket();
  for (const file of files) {
    const relativePath = path.relative(dir, file.path);
    const key = `${prefix}/${relativePath}`.replace(/\\/g, '/'); // Normalize windows paths just in case
    const contentType = mime.lookup(file.path) || 'application/octet-stream';

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(file.path),
      ContentLength: file.size,
      ContentType: contentType,
    }));
  }
  
  if (onProgress) {
    onProgress(
      `Uploaded ${files.length} files (${totalBytes} bytes) to ${bucket}/${prefix}`,
    );
  }
}
