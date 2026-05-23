import path from 'node:path';

import {
    backendSrc,
    findPythonCommand,
    loadBackendEnv,
    run,
} from './node-runner.mjs';

const [toolName, ...toolArgs] = process.argv.slice(2);

if (!toolName) {
    console.error('Usage: npm run server:tool -- <tool.py> [args...]');
    process.exit(1);
}

const python = findPythonCommand();
const toolPath = path.join('utility', toolName);

run(python.command, [
    ...python.args,
    toolPath,
    ...toolArgs,
], {
    cwd: backendSrc,
    env: loadBackendEnv(),
});
