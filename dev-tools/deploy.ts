import { copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { runScript } from './core'

if (!existsSync(resolve('.env'))) {
    copyFileSync(resolve('./dev-tools/sample/.env'), resolve('.env'))
}

runScript('deploy')