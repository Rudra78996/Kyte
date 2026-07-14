import { encrypt, decrypt } from './crypto.util';

describe('Crypto Utility', () => {
  it('should encrypt and decrypt a string correctly', () => {
    const originalText = 'my-super-secret-api-key-123!';
    
    const { encryptedValue, iv } = encrypt(originalText);
    
    expect(encryptedValue).toBeDefined();
    expect(iv).toBeDefined();
    expect(encryptedValue).not.toEqual(originalText);
    
    const decryptedText = decrypt(encryptedValue, iv);
    
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
    
    const { encryptedValue, iv } = encrypt(originalText);
    const decryptedText = decrypt(encryptedValue, iv);
    
    expect(decryptedText).toEqual(originalText);
  });

  it('should handle long strings', () => {
    const originalText = 'a'.repeat(1000); // 1000 character string
    
    const { encryptedValue, iv } = encrypt(originalText);
    const decryptedText = decrypt(encryptedValue, iv);
    
    expect(decryptedText).toEqual(originalText);
  });
});
