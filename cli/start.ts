import { spawn } from 'child_process'
import { copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'

if (!existsSync(resolve('.env'))) {
    copyFileSync(resolve('sample.env'), resolve('.env'))
}

spawn('docker-compose', ['up'], { stdio: 'inherit' })