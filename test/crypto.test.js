const crypto = require('crypto');

// Test the encryption/decryption functionality similar to routes/index.js
describe('Crypto functions', () => {
  const CIPHER_ALGORITHM = "aes-256-gcm";
  const PASSWORD_KEY_LENGTH = 12;

  // Helper function from routes/index.js
  function uid(len) {
    len = len || 7;
    return crypto
      .randomBytes(len)
      .toString("base64")
      .slice(0, len)
      .replace(/\+/g, "0")
      .replace(/\//g, "0");
  }

  describe('uid function', () => {
    test('should generate string of specified length', () => {
      const result = uid(10);
      expect(result).toHaveLength(10);
    });

    test('should generate string of default length 7', () => {
      const result = uid();
      expect(result).toHaveLength(7);
    });

    test('should generate different strings on multiple calls', () => {
      const result1 = uid(10);
      const result2 = uid(10);
      expect(result1).not.toBe(result2);
    });

    test('should only contain alphanumeric characters', () => {
      const result = uid(20);
      expect(result).toMatch(/^[a-zA-Z0-9]+$/);
    });
  });

  describe('encryption/decryption', () => {
    test('should encrypt and decrypt a secret correctly', () => {
      const secret = "This is a test secret";
      const password = uid(PASSWORD_KEY_LENGTH);
      
      // Encrypt
      const iv = crypto.randomBytes(12);
      const derivedKey = crypto.createHash('sha256').update(password).digest();
      const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, derivedKey, iv);
      const encrypted = cipher.update(secret, 'utf8', 'hex') + cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      // Decrypt
      const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, derivedKey, iv);
      decipher.setAuthTag(authTag);
      const decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
      
      expect(decrypted).toBe(secret);
    });

    test('should fail to decrypt with wrong password', () => {
      const secret = "This is a test secret";
      const password = uid(PASSWORD_KEY_LENGTH);
      const wrongPassword = uid(PASSWORD_KEY_LENGTH);
      
      // Encrypt
      const iv = crypto.randomBytes(12);
      const derivedKey = crypto.createHash('sha256').update(password).digest();
      const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, derivedKey, iv);
      const encrypted = cipher.update(secret, 'utf8', 'hex') + cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      // Try to decrypt with wrong password
      const wrongDerivedKey = crypto.createHash('sha256').update(wrongPassword).digest();
      const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, wrongDerivedKey, iv);
      decipher.setAuthTag(authTag);
      
      expect(() => {
        decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
      }).toThrow();
    });

    test('should handle empty secret', () => {
      const secret = "";
      const password = uid(PASSWORD_KEY_LENGTH);
      
      // Encrypt
      const iv = crypto.randomBytes(12);
      const derivedKey = crypto.createHash('sha256').update(password).digest();
      const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, derivedKey, iv);
      const encrypted = cipher.update(secret, 'utf8', 'hex') + cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      // Decrypt
      const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, derivedKey, iv);
      decipher.setAuthTag(authTag);
      const decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
      
      expect(decrypted).toBe(secret);
    });

    test('should handle large secret', () => {
      const secret = "A".repeat(10000);
      const password = uid(PASSWORD_KEY_LENGTH);
      
      // Encrypt
      const iv = crypto.randomBytes(12);
      const derivedKey = crypto.createHash('sha256').update(password).digest();
      const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, derivedKey, iv);
      const encrypted = cipher.update(secret, 'utf8', 'hex') + cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      // Decrypt
      const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, derivedKey, iv);
      decipher.setAuthTag(authTag);
      const decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
      
      expect(decrypted).toBe(secret);
    });
  });
});