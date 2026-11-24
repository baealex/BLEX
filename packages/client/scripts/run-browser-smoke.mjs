import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { access, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const serverEntry = fileURLToPath(new URL('../../server/dist/src/main.js', import.meta.url));
const smokeEntry = fileURLToPath(new URL('./browser-smoke.mjs', import.meta.url));

function launch(entry, options) {
    const child = spawn(process.execPath, [entry], options);
    let error;
    child.once('error', (failure) => {
        error = failure;
    });
    const done = new Promise((resolve) => child.once('close', (code, signal) => resolve({ code, signal, error })));
    return { child, done };
}

async function stop(handle) {
    if (!handle) return;
    const timeout = setTimeout(() => handle.child.kill('SIGKILL'), 5000);
    timeout.unref();
    if (handle.child.exitCode === null && handle.child.signalCode === null) handle.child.kill('SIGTERM');
    await handle.done;
    clearTimeout(timeout);
}

async function unusedPort() {
    const socket = createServer();
    await new Promise((resolve, reject) => {
        socket.once('error', reject);
        socket.listen(0, '127.0.0.1', resolve);
    });
    const { port } = socket.address();
    await new Promise((resolve, reject) => socket.close((error) => (error ? reject(error) : resolve())));
    return port;
}

let directory;
let server;
let smoke;
let interrupted = false;
let serverOutput = '';
const interrupt = () => {
    interrupted = true;
    smoke?.child.kill('SIGTERM');
    server?.child.kill('SIGTERM');
};
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);

try {
    await access(serverEntry);
    await access(new URL('../../server/dist/client/.vite/manifest.json', import.meta.url));
    directory = await mkdtemp(join(tmpdir(), 'blex-browser-smoke-'));
    const media = join(directory, 'media');
    await mkdir(media);
    const port = await unusedPort();
    const origin = `http://127.0.0.1:${port}`;
    const setupToken = randomBytes(24).toString('hex');
    const env = {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(port),
        SITE_URL: origin,
        BLEX_V4_DB_PATH: join(directory, 'db.sqlite3'),
        BLEX_V4_MEDIA_PATH: media,
        BLEX_LEGACY_PATH: join(directory, 'legacy'),
        BLEX_V4_READ_ONLY: '0',
        BLEX_DEFAULT_LANGUAGE: 'ko',
        INITIAL_SETUP_TOKEN: setupToken,
        SECRET_KEY: randomBytes(32).toString('hex'),
        CIPHER_KEY: randomBytes(16).toString('hex')
    };
    server = launch(serverEntry, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [server.child.stdout, server.child.stderr]) {
        stream.on('data', (chunk) => {
            serverOutput = (serverOutput + chunk).slice(-16000);
        });
    }
    let serverExit;
    void server.done.then((result) => {
        serverExit = result;
    });

    let ready = false;
    for (let attempt = 0; attempt < 240; attempt += 1) {
        if (interrupted) throw new Error('Browser verification interrupted.');
        if (serverExit) throw new Error('The temporary server stopped before startup.', { cause: serverExit.error });
        try {
            const response = await fetch(`${origin}/setup`, { signal: AbortSignal.timeout(1000) });
            await response.arrayBuffer();
            if (response.ok) {
                ready = true;
                break;
            }
        } catch {}
        await delay(250);
    }
    if (!ready) throw new Error('The temporary server did not become ready.');
    smoke = launch(smokeEntry, {
        env: { ...env, BLEX_SMOKE_URL: origin, BLEX_SETUP_TOKEN: setupToken },
        stdio: 'inherit'
    });
    const result = await smoke.done;
    if (result.code !== 0)
        throw new Error(`Browser verification failed (${result.signal ?? result.code}).`, { cause: result.error });
} catch (error) {
    console.error(error);
    if (serverOutput) console.error(serverOutput);
    if (error.code === 'ENOENT') console.error('Build first with pnpm build, then run pnpm test:browser.');
    process.exitCode = 1;
} finally {
    await stop(smoke);
    await stop(server);
    if (directory) await rm(directory, { recursive: true, force: true });
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
}
