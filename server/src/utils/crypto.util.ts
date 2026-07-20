import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function encryptionKey() {
  const configured = process.env.ENCRYPTION_KEY?.trim();
  if (!configured) {
    throw new Error(
      'ENCRYPTION_KEY is required and must be a Base64-encoded 32-byte key',
    );
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(configured)) {
    throw new Error(
      'ENCRYPTION_KEY must be a valid Base64-encoded 32-byte key',
    );
  }
  const key = Buffer.from(configured, 'base64');
  const canonical = key.toString('base64').replace(/=+$/, '');
  if (key.length !== 32 || canonical !== configured.replace(/=+$/, '')) {
    throw new Error(
      'ENCRYPTION_KEY must be a valid Base64-encoded 32-byte key',
    );
  }
  return key;
}

export function assertEncryptionConfigured() {
  encryptionKey();
}

export function encrypt(text: string): {
  encryptedValue: string;
  iv: string;
  authTag: string;
} {
  const iv = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);

  return {
    encryptedValue: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decrypt(
  encryptedValue: string,
  ivValue: string,
  authTagValue: string,
): string {
  const iv = Buffer.from(ivValue, 'base64');
  const authTag = Buffer.from(authTagValue, 'base64');
  if (iv.length !== NONCE_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('Encrypted secret metadata is invalid');
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
