import { spawn } from 'child_process'
import { copyFileSync, existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

export const SAMPLE_PATH = './dev-tools/sample';
export const SCRIPT_PATH = './dev-tools/script';

export function runScript(scriptName: string, option?: string[]) {
    spawn('sh', [resolve(`${SCRIPT_PATH}/${scriptName}.sh`)].concat(option ? option : []), { stdio: 'inherit' })
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
        fetch('https://www.dropbox.com/scl/fi/frtd7j45fg3nrxrw64oue/db.sqlite3?rlkey=dqbi2f6rrykz2ykq04md3pglg&dl=1')
            .then(async res => {
                writeFileSync(resolve('./backend/src/db.sqlite3'), Buffer.from(await res.arrayBuffer()))
            })
}
