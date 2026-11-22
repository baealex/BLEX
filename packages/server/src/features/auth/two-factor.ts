import { createHash, timingSafeEqual } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';
import { decryptSecret } from './encrypted-secret.js';

export interface StoredSecondFactor {
  totpSecret: string;
  recoveryKey: string;
}

export function verifySecondFactor(
  stored: StoredSecondFactor,
  code: string,
  cipherKey: string,
  timestamp = Date.now(),
): boolean {
  if (code.length > 6) {
    const recoveryKey = stored.recoveryKey.trim();
    const token = code.trim();
    if (!recoveryKey || !token) return false;
    const validHash = /^[a-f0-9]{64}$/.test(recoveryKey);
    const expected = Buffer.from(recoveryKey, validHash ? 'hex' : 'utf8');
    const supplied = validHash ? createHash('sha256').update(token).digest() : Buffer.from(token);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  }

  if (!/^\d{6}$/.test(code)) return false;
  const encoded = stored.totpSecret.trim();
  const secret = decryptSecret(encoded, cipherKey) ?? encoded;
  if (!/^[A-Z2-7]{16,64}=*$/i.test(secret)) return false;
  try {
    const totp = new TOTP({ secret: Secret.fromBase32(secret.toUpperCase()), algorithm: 'SHA1', digits: 6, period: 30 });
    return totp.validate({ token: code, window: 1, timestamp }) !== null;
  } catch {
    return false;
  }
}
