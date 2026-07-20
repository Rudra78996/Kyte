export function assertWebhookSecretConfigured(
  env: NodeJS.ProcessEnv = process.env,
) {
  const secret = env.GITHUB_WEBHOOK_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error(
      'GITHUB_WEBHOOK_SECRET is required and must contain at least 32 bytes',
    );
  }
}
