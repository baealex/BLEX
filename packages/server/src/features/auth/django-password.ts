import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const deriveKey = promisify(pbkdf2);
const djangoIterations = 1_200_000;
const dummyDigest = Buffer.alloc(32);

export async function hashDjangoPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await deriveKey(password, salt, djangoIterations, 32, 'sha256');
  return `pbkdf2_sha256$${djangoIterations}$${salt}$${hash.toString('base64')}`;
}

export async function verifyDjangoPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, rounds, salt, encodedDigest, extra] = encoded.split('$');
  const iterations = Number(rounds);
  const digest = encodedDigest ? Buffer.from(encodedDigest, 'base64') : dummyDigest;
  const sha1 = algorithm === 'pbkdf2_sha1';
  const supported = (algorithm === 'pbkdf2_sha256' || sha1) &&
    Number.isSafeInteger(iterations) && iterations > 0 && iterations <= 10_000_000 &&
    Boolean(salt) && digest.length === (sha1 ? 20 : 32) &&
    encodedDigest === digest.toString('base64') && extra === undefined;

  const expected = supported ? digest : dummyDigest;
  const derived = await deriveKey(
    password,
    supported ? salt : 'BlexLoginTiming',
    supported ? iterations : djangoIterations,
    expected.length,
    supported && sha1 ? 'sha1' : 'sha256',
  );
  return timingSafeEqual(derived, expected) && supported;
}
