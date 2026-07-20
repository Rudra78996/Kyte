process.env.ENCRYPTION_KEY ??=
  'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
process.env.GITHUB_WEBHOOK_SECRET ??= 'x'.repeat(32);
process.env.REDIS_URL ??= 'redis://:test-password@localhost:6379';
process.env.MINIO_ENDPOINT ??= 'http://localhost:9000';
process.env.MINIO_ACCESS_KEY ??= 'test-app-user';
process.env.MINIO_SECRET_KEY ??= 'test-app-secret';
process.env.MINIO_BUCKET ??= 'test-deployments';
