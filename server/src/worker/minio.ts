import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as mime from 'mime-types';

const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
const accessKeyId = process.env.MINIO_ACCESS_KEY || 'admin';
const secretAccessKey = process.env.MINIO_SECRET_KEY || 'password';
const bucket = process.env.MINIO_BUCKET || 'deployly-projects';

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

async function* getFiles(dir: string): AsyncGenerator<string> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* getFiles(res);
    } else {
      yield res;
    }
  }
}

export async function uploadDirectory(prefix: string, dir: string, onProgress?: (msg: string) => void) {
  await ensureBucket();
  
  if (!(await fs.pathExists(dir))) {
    throw new Error(`Directory ${dir} does not exist to upload`);
  }

  let count = 0;
  for await (const file of getFiles(dir)) {
    const relativePath = path.relative(dir, file);
    const key = `${prefix}/${relativePath}`.replace(/\\/g, '/'); // Normalize windows paths just in case
    const contentType = mime.lookup(file) || 'application/octet-stream';
    const body = await fs.readFile(file);

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    count++;
  }
  
  if (onProgress) {
    onProgress(`Uploaded ${count} files to ${bucket}/${prefix}`);
  }
}
