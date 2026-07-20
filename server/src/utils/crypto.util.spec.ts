import {
  assertEncryptionConfigured,
  decrypt,
  encrypt,
} from './crypto.util';

describe('Crypto Utility', () => {
  it('should encrypt and decrypt a string correctly', () => {
    const originalText = 'my-super-secret-api-key-123!';
    
    const { encryptedValue, iv, authTag } = encrypt(originalText);
    
    expect(encryptedValue).toBeDefined();
    expect(iv).toBeDefined();
    expect(authTag).toBeDefined();
    expect(encryptedValue).not.toEqual(originalText);
    
    const decryptedText = decrypt(encryptedValue, iv, authTag);
    
    expect(decryptedText).toEqual(originalText);
  });

  it('should produce different ciphertexts for the same plaintext due to random IV', () => {
    const originalText = 'another-secret-value';
    
    const result1 = encrypt(originalText);
    const result2 = encrypt(originalText);
    
    expect(result1.iv).not.toEqual(result2.iv);
    expect(result1.encryptedValue).not.toEqual(result2.encryptedValue);
  });

  it('should handle empty strings', () => {
    const originalText = '';
    
    const { encryptedValue, iv, authTag } = encrypt(originalText);
    const decryptedText = decrypt(encryptedValue, iv, authTag);
    
    expect(decryptedText).toEqual(originalText);
  });

  it('should handle long strings', () => {
    const originalText = 'a'.repeat(1000); // 1000 character string
    
    const { encryptedValue, iv, authTag } = encrypt(originalText);
    const decryptedText = decrypt(encryptedValue, iv, authTag);
    
    expect(decryptedText).toEqual(originalText);
  });

  it('rejects tampered ciphertext and authentication tags', () => {
    const encrypted = encrypt('do-not-change-me');
    const ciphertext = Buffer.from(encrypted.encryptedValue, 'base64');
    ciphertext[0] ^= 1;

    expect(() =>
      decrypt(
        ciphertext.toString('base64'),
        encrypted.iv,
        encrypted.authTag,
      ),
    ).toThrow();
    expect(() =>
      decrypt(
        encrypted.encryptedValue,
        encrypted.iv,
        Buffer.alloc(16).toString('base64'),
      ),
    ).toThrow();
  });

  it('fails closed when the encryption key is missing or malformed', () => {
    const original = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => assertEncryptionConfigured()).toThrow('ENCRYPTION_KEY is required');
    process.env.ENCRYPTION_KEY = 'not-base64!';
    expect(() => assertEncryptionConfigured()).toThrow('valid Base64');
    process.env.ENCRYPTION_KEY = original;
  });
});
