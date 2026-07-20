import { createHmac, randomUUID } from 'node:crypto';
import Redis from 'ioredis';

const endpoint =
  process.env.DUMMY_WEBHOOK_URL ??
  'http://localhost:3000/webhooks/github';
const secret = process.env.GITHUB_WEBHOOK_SECRET;
const redisUrl = process.env.REDIS_URL;

if (!secret || Buffer.byteLength(secret) < 32) {
  throw new Error('GITHUB_WEBHOOK_SECRET must contain at least 32 bytes');
}
if (!redisUrl) throw new Error('REDIS_URL is required');

const signedRequest = async (event, deliveryId, payload, valid = true) => {
  const body = JSON.stringify(payload);
  const signature = valid
    ? createHmac('sha256', secret).update(body).digest('hex')
    : '0'.repeat(64);
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-github-event': event,
      'x-github-delivery': deliveryId,
      'x-hub-signature-256': `sha256=${signature}`,
    },
    body,
  });
};

const invalid = await signedRequest('ping', randomUUID(), { zen: 'dummy' }, false);
if (invalid.status !== 401) {
  throw new Error(`Invalid signature returned ${invalid.status}, expected 401`);
}

const ping = await signedRequest('ping', randomUUID(), { zen: 'dummy' });
if (ping.status !== 200 || (await ping.json()).message !== 'pong') {
  throw new Error('Signed GitHub ping was not accepted');
}

const deliveryId = randomUUID();
const push = {
  ref: 'refs/heads/main',
  after: 'a'.repeat(40),
  deleted: false,
  repository: {
    id: 9_999_999_999,
    full_name: 'dummy-security/phase-eight-webhook',
  },
  head_commit: { message: 'Dummy signed security test' },
};
const first = await signedRequest('push', deliveryId, push);
const replay = await signedRequest('push', deliveryId, push);
if (first.status !== 200 || replay.status !== 200) {
  throw new Error(
    `Signed push/replay returned ${first.status}/${replay.status}`,
  );
}

const redis = new Redis(redisUrl);
const key = `github:webhook-delivery:${deliveryId}`;
const ttl = await redis.ttl(key);
await redis.del(key);
await redis.quit();
if (ttl < 86_390 || ttl > 86_400) {
  throw new Error(`Unexpected webhook replay TTL: ${ttl}`);
}

console.log(
  'Dummy webhook validation passed: invalid signature rejected, signed ping accepted, signed push accepted, and replay ID stored for 24 hours.',
);
