import {
    backendSrc,
    findPythonCommand,
    loadBackendEnv,
    run,
} from './node-runner.mjs';

const python = findPythonCommand();

run(python.command, [
    ...python.args,
    'manage.py',
    ...process.argv.slice(2),
], {
    cwd: backendSrc,
    env: loadBackendEnv(),
});
