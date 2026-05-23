import fs from 'node:fs';

import {
    backendSrc,
    ensureBackendEnv,
    findPythonCommand,
    isCompatiblePython,
    runChecked,
    venvDir,
    venvPythonPath,
} from './node-runner.mjs';

ensureBackendEnv();

if (fs.existsSync(venvPythonPath()) && !isCompatiblePython(venvPythonPath())) {
    console.error('Existing backend/src/mvenv uses an incompatible Python version.');
    console.error('Remove backend/src/mvenv and rerun npm i with Python 3.12+ available.');
    process.exit(1);
}

if (!fs.existsSync(venvPythonPath())) {
    const python = findPythonCommand();
    runChecked(python.command, [
        ...python.args,
        '-m',
        'venv',
        venvDir,
    ], { cwd: backendSrc });
}

runChecked(venvPythonPath(), [
    '-m',
    'pip',
    'install',
    '-r',
    'requirements.txt',
], { cwd: backendSrc });
