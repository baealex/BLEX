import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile();
} catch (error) {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
}

if (!process.env.BLEX_V4_DB_PATH) {
  const local = fileURLToPath(new URL('../../.local/', import.meta.url));
  const database = resolve(local, 'db.sqlite3');
  const media = resolve(local, 'media');
  const secrets = resolve(local, 'secrets.env');
  await mkdir(media, { recursive: true, mode: 0o700 });
  try {
    await writeFile(secrets, `SECRET_KEY=${randomBytes(32).toString('base64url')}\nCIPHER_KEY=${randomBytes(16).toString('hex')}\n`,
      { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
  }
  process.loadEnvFile(secrets);
  process.env.BLEX_V4_DB_PATH = database;
  process.env.BLEX_V4_MEDIA_PATH ??= media;
}

await import('./main.js');
