import { spawn } from 'child_process'
import { copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'

export const SAMPLE_PATH = './dev-tools/sample';
export const SHELL_PATH = './dev-tools/shell';

export function runScript(scriptName: string) {
    spawn('sh', [ resolve(`${SHELL_PATH}/${scriptName}.sh`) ], { stdio: 'inherit' })
}

export function copySampleData() {
    if (!existsSync(resolve('./backend/.env')))
        copyFileSync(
            resolve('./dev-tools/sample/backend/.env'),
            resolve('./backend/.env')
        )

    if (!existsSync(resolve('./frontend/.env')))
        copyFileSync(
            resolve('./dev-tools/sample/frontend/.env'),
            resolve('./frontend/.env')
        )

    if (!existsSync(resolve('./backend/src/db.sqlite3')))
        copyFileSync(
            resolve('./dev-tools/sample/backend/db.sqlite3'),
            resolve('./backend/src/db.sqlite3')
        )
}
