import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { copySampleData, runScript } from './core'

function overrideEntrypoint(file: string, command: string) {
    return file.split('ENTRYPOINT')[0] + command
}

function main() {
    copySampleData()

    writeFileSync(
        resolve('./backend/DockerfileDev'),
        overrideEntrypoint(readFileSync(resolve('./backend/Dockerfile')).toString(), [
            `ENTRYPOINT ["python", "manage.py"]`,
            `CMD ["runserver", "0.0.0.0:9000"]`
        ].join('\n'))
    )

    writeFileSync(
        resolve('./frontend/DockerfileDev'),
        overrideEntrypoint(readFileSync(resolve('./frontend/Dockerfile')).toString(), [
            `ENTRYPOINT ["npm", "run"]`,
            `CMD ["dev"]`
        ].join('\n'))
    )

    runScript('dev', process.argv.slice(2))
}

main()