import { spawn } from 'child_process'
import { copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'

if (!existsSync(resolve('.env'))) {
    copyFileSync(resolve('./cli/sample/.env'), resolve('.env'))
}

spawn('sh', [ resolve('./cli/shell/deploy.sh') ], { stdio: 'inherit' })