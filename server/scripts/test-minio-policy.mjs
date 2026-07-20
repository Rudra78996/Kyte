import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListBucketsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const bucket = required('MINIO_BUCKET');
const client = new S3Client({
  endpoint: required('MINIO_ENDPOINT'),
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: required('MINIO_ACCESS_KEY'),
    secretAccessKey: required('MINIO_SECRET_KEY'),
  },
});
const key = `security-tests/${randomUUID()}.txt`;
const privateBucket = 'kyte-private-control';

await client.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: 'bucket-scoped policy test',
  }),
);
const object = await client.send(
  new GetObjectCommand({ Bucket: bucket, Key: key }),
);
if ((await object.Body.transformToString()) !== 'bucket-scoped policy test') {
  throw new Error('Application user could not read its test object');
}
await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

const listed = await client.send(new ListBucketsCommand({}));
if ((listed.Buckets ?? []).some((listedBucket) => listedBucket.Name !== bucket)) {
  throw new Error('Application user can discover a root-only bucket');
}

let privateWriteDenied = false;
try {
  await client.send(
    new PutObjectCommand({
      Bucket: privateBucket,
      Key: key,
      Body: 'must not be written',
    }),
  );
} catch (error) {
  privateWriteDenied =
    error?.name === 'AccessDenied' ||
    error?.$metadata?.httpStatusCode === 403;
}
if (!privateWriteDenied) {
  throw new Error('Application user unexpectedly wrote to a root-only bucket');
}

console.log(
  'MinIO policy validation passed: application object access works and the root-only control bucket is hidden and denied.',
);
