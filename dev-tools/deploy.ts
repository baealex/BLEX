import { existsSync } from 'fs'
import { copySampleData, runScript } from './core'

async function main() {
    copySampleData()

    if (existsSync('deploy.overrides.sh')) {
        runScript('deploy.overrides')
    } else {
        runScript('deploy')
    }
}

main()
