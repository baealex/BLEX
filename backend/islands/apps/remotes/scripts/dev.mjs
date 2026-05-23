import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const watchAssetsScript = path.join(__dirname, 'watch-assets.js');
const viteEntry = require.resolve('vite');
const viteBin = path.resolve(path.dirname(viteEntry), '../../bin/vite.js');

const children = new Map();
let stopping = false;
let exitCode = 0;

const stopAll = () => {
    if (stopping) {
        return;
    }

    stopping = true;

    for (const child of children.values()) {
        if (child.exitCode === null && !child.killed) {
            child.kill();
        }
    }
};

const start = (name, command, args, { stopOnExit = false } = {}) => {
    const child = spawn(command, args, {
        cwd: appRoot,
        stdio: 'inherit',
        windowsHide: true
    });

    children.set(name, child);

    child.on('exit', (code, signal) => {
        children.delete(name);

        if (stopping) {
            if (children.size === 0) {
                process.exit(exitCode);
            }
            return;
        }

        if (code && code !== 0) {
            exitCode = code;
            console.error(`[dev] ${name} exited with code ${code}.`);
            stopAll();
            return;
        }

        if (signal) {
            exitCode = 1;
            console.error(`[dev] ${name} exited with signal ${signal}.`);
            stopAll();
            return;
        }

        if (stopOnExit || children.size === 0) {
            stopAll();
        }
    });

    child.on('error', (error) => {
        children.delete(name);
        exitCode = 1;
        console.error(`[dev] Failed to start ${name}:`, error);
        stopAll();
    });
};

process.on('SIGINT', () => {
    exitCode = 130;
    stopAll();
});

process.on('SIGTERM', () => {
    exitCode = 143;
    stopAll();
});

start('watch-assets', process.execPath, [watchAssetsScript]);
start('vite', process.execPath, [viteBin, 'dev'], { stopOnExit: true });
