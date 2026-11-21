import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function encryptDjangoSecret(plaintext: string, cipherKey: string): string {
  const key = Buffer.from(cipherKey, 'utf8');
  if (key.length !== 32) throw new Error('CIPHER_KEY must encode to exactly 32 bytes.');
  const iv = randomBytes(16);
  const header = Buffer.alloc(9, 0);
  header[0] = 0x80;
  header.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1_000)), 1);
  const cipher = createCipheriv('aes-128-cbc', key.subarray(16), iv);
  const message = Buffer.concat([header, iv, cipher.update(plaintext, 'utf8'), cipher.final()]);
  const signature = createHmac('sha256', key.subarray(0, 16)).update(message).digest();
  return Buffer.concat([message, signature]).toString('base64').replaceAll('+', '-').replaceAll('/', '_');
}

/** Reads Django's Fernet token with the original 32-byte BLEX CIPHER_KEY. */
export function decryptDjangoSecret(encoded: string, cipherKey: string): string | null {
  const key = Buffer.from(cipherKey, 'utf8');
  if (key.length !== 32 || !/^[a-zA-Z0-9_-]+={0,2}$/.test(encoded)) return null;

  const token = Buffer.from(encoded, 'base64url');
  if (token.length < 73 || token[0] !== 0x80 || (token.length - 57) % 16 !== 0) return null;

  const message = token.subarray(0, -32);
  const signature = createHmac('sha256', key.subarray(0, 16)).update(message).digest();
  if (!timingSafeEqual(signature, token.subarray(-32))) return null;

  try {
    const decipher = createDecipheriv('aes-128-cbc', key.subarray(16), token.subarray(9, 25));
    const plaintext = Buffer.concat([decipher.update(message.subarray(25)), decipher.final()]);
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
  } catch {
    return null;
  }
}
