// T069 — Unit tests for encryption.ts
// encrypt/decrypt round-trip, tamper detection

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Set required env variable before importing module
process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes

const { encrypt, decrypt } = await import('../../src/lib/encryption.js');

describe('encryption — encrypt/decrypt round-trip', () => {
  it('encrypts and decrypts a plain string', () => {
    const plaintext = 'hello world';
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('encrypts and decrypts an OAuth token', () => {
    const token = 'ya29.a0AfB_byDwHalWOBVcXTz3_FAKE_ACCESS_TOKEN';
    const encrypted = encrypt(token);
    expect(decrypt(encrypted)).toBe(token);
  });

  it('produces different ciphertext on each encryption (random IV)', () => {
    const plaintext = 'same plaintext';
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);
    expect(enc1).not.toBe(enc2);
  });

  it('returns a base64 string', () => {
    const encrypted = encrypt('test');
    expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
  });

  it('round-trips unicode and special characters', () => {
    const payload = '{"sub":"12345","email":"user@example.com","name":"José"}';
    expect(decrypt(encrypt(payload))).toBe(payload);
  });
});

describe('encryption — tamper detection', () => {
  it('throws when ciphertext is tampered', () => {
    const encrypted = encrypt('sensitive data');
    // Flip a byte in the middle of the base64 string
    const buf = Buffer.from(encrypted, 'base64');
    buf[20] = buf[20] ^ 0xff; // flip bits
    const tampered = buf.toString('base64');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('throws on empty string input', () => {
    expect(() => decrypt('')).toThrow();
  });

  it('throws when auth tag is corrupted', () => {
    const encrypted = encrypt('my secret');
    const buf = Buffer.from(encrypted, 'base64');
    // Auth tag is bytes 16–32; flip byte 17
    buf[17] = buf[17] ^ 0xff;
    const corrupted = buf.toString('base64');
    expect(() => decrypt(corrupted)).toThrow();
  });
});

describe('encryption — key validation', () => {
  it('throws if TOKEN_ENCRYPTION_KEY is missing', () => {
    const original = process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow('TOKEN_ENCRYPTION_KEY');
    process.env.TOKEN_ENCRYPTION_KEY = original;
  });

  it('throws if TOKEN_ENCRYPTION_KEY is wrong length', () => {
    const original = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = 'tooshort';
    expect(() => encrypt('test')).toThrow('TOKEN_ENCRYPTION_KEY');
    process.env.TOKEN_ENCRYPTION_KEY = original;
  });
});
