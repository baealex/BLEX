import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptsDir, '..');
export const backendSrc = path.join(repoRoot, 'backend', 'src');
export const backendEnv = path.join(repoRoot, 'backend', '.env');
export const sampleEnv = path.join(repoRoot, 'samples', '.env');
export const venvDir = path.join(backendSrc, 'mvenv');

export function ensureBackendEnv() {
    if (!fs.existsSync(backendEnv) && fs.existsSync(sampleEnv)) {
        fs.copyFileSync(sampleEnv, backendEnv);
    }
}

export function loadBackendEnv() {
    const env = { ...process.env };

    env.PYTHONUTF8 ??= '1';
    env.PYTHONIOENCODING ??= 'utf-8';

    if (!fs.existsSync(backendEnv)) {
        return env;
    }

    for (const rawLine of fs.readFileSync(backendEnv, 'utf8').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || !line.includes('=')) {
            continue;
        }

        const equalsIndex = line.indexOf('=');
        const key = line.slice(0, equalsIndex).trim();
        let value = line.slice(equalsIndex + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        env[key] = value;
    }

    return env;
}

export function venvPythonPath() {
    return process.platform === 'win32'
        ? path.join(venvDir, 'Scripts', 'python.exe')
        : path.join(venvDir, 'bin', 'python');
}

export function run(command, args, options = {}) {
    const status = runChecked(command, args, options);
    process.exit(status);
}

export function runChecked(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        env: process.env,
        stdio: 'inherit',
        shell: false,
        ...options,
    });

    if (result.error) {
        console.error(result.error.message);
        process.exit(1);
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }

    return result.status ?? 0;
}

function commandWorks(command, args) {
    const result = spawnSync(command, args, {
        stdio: 'ignore',
        shell: false,
    });
    return !result.error && result.status === 0;
}

export function isCompatiblePython(command, args = []) {
    return commandWorks(command, [
        ...args,
        '-c',
        'import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)',
    ]);
}

export function findPythonCommand() {
    if (fs.existsSync(venvPythonPath()) && isCompatiblePython(venvPythonPath())) {
        return { command: venvPythonPath(), args: [] };
    }

    const candidates = process.platform === 'win32'
        ? [
            { command: 'py', args: ['-3.12'] },
            { command: 'python', args: [] },
            { command: 'python3', args: [] },
        ]
        : [
            { command: 'python3', args: [] },
            { command: 'python', args: [] },
        ];

    for (const candidate of candidates) {
        if (isCompatiblePython(candidate.command, candidate.args)) {
            return candidate;
        }
    }

    console.error('Python 3.12 or newer is required for this project.');
    console.error('Install Python 3.12+, or set up backend/src/mvenv with a compatible Python.');
    process.exit(1);
}
