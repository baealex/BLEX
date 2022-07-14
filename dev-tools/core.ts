import { spawn } from 'child_process'
import { copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'

export const SAMPLE_PATH = './dev-tools/sample';
export const SHELL_PATH = './dev-tools/shell';

export function runScript(scriptName: string) {
    spawn('sh', [ resolve(`${SHELL_PATH}/${scriptName}.sh`) ], { stdio: 'inherit' })
}

export function copyEnv() {
    copyFileSync(resolve(`${SAMPLE_PATH}/.env`), resolve('.env'))
}