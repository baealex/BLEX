import { buildApp } from './app.js';
import { createToken } from './features/auth/session.js';
import { trustedProxiesFromEnv } from './platform/runtime-config.js';
import { DatabaseSetupError, prepareDatabase } from './startup/prepare-database.js';

const dbPath = process.env.BLEX_V4_DB_PATH;
if (!dbPath) throw new Error('Set BLEX_V4_DB_PATH to a migrated SQLite database.');

const port = Number(process.env.PORT ?? 8040);
const siteUrl = new URL(process.env.SITE_URL ?? `http://localhost:${port}`);
const { SECRET_KEY: secretKey, CIPHER_KEY: cipherKey } = process.env;
const readOnly = process.env.BLEX_V4_READ_ONLY === '1';
if (!readOnly && (!secretKey || !cipherKey || Buffer.byteLength(cipherKey, 'utf8') !== 32)) {
  throw new Error('Set SECRET_KEY and a 32-byte CIPHER_KEY, or use BLEX_V4_READ_ONLY=1 to inspect a backup.');
}
const setupToken = process.env.INITIAL_SETUP_TOKEN || createToken();
const trustedProxies = trustedProxiesFromEnv(process.env);
if (!readOnly && siteUrl.protocol === 'https:' && !trustedProxies) {
  console.warn('BLEX_TRUSTED_PROXIES is not set. Behind an HTTPS proxy, every visitor shares one login rate limit.');
}
if (!readOnly) {
  try {
    await prepareDatabase({
      databasePath: dbPath,
      mediaRoot: process.env.BLEX_V4_MEDIA_PATH,
      legacyRoot: process.env.BLEX_LEGACY_PATH,
      portMapping: process.env.BLEX_PORT_MAPPING,
      containerPort: String(port),
    });
  } catch (error) {
    if (!(error instanceof DatabaseSetupError)) throw error;
    console.error(error.message);
    process.exit(1);
  }
}
const auth =
  !readOnly && secretKey && cipherKey
    ? { secretKey, cipherKey, setupToken, trustedProxies, deliverNotifications: true }
    : undefined;
const app = await buildApp(dbPath, siteUrl, auth, process.env.BLEX_V4_MEDIA_PATH);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void app.close());
}

try {
  const address = await app.listen({ host: process.env.HOST ?? '127.0.0.1', port });
  console.info(`BLEX listening at ${address}`);
  if (auth && (await app.inject('/setup')).statusCode === 200) {
    console.info(
      `Open ${new URL('/setup?' + new URLSearchParams({ token: setupToken }), siteUrl).href} to create the first administrator.`,
    );
  }
} catch (error) {
  await app.close();
  throw error;
}
