import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns base64-encoded string: iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Pack: iv (16) + authTag (16) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts a base64-encoded string produced by encrypt().
 * Throws if tampering is detected (auth tag mismatch).
 */
export function decrypt(encryptedBase64: string): string {
  const key = getKey();
  const combined = Buffer.from(encryptedBase64, 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
