import { spawn } from 'child_process'
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'

if (!existsSync(resolve('./backend/src/main/settings.py')))
    copyFileSync(
        resolve('./cli/sample/docker_dev_backend_settings.py'),
        resolve('./backend/src/main/settings.py')
    )

if (!existsSync(resolve('./backend/src/db.sqlite3')))
    copyFileSync(
        resolve('./cli/sample/docker_dev_backend_settings.py'),
        resolve('./backend/src/db.sqlite3')
    )

const beDockerFile = readFileSync(resolve('./backend/Dockerfile')).toString()

const beDevCommand = `
ENTRYPOINT ["python", "manage.py"]
CMD ["runserver", "0.0.0.0:9000"]
`

writeFileSync(
    resolve('./backend/DockerfileDev'),
    beDockerFile.split('ENTRYPOINT')[0] + beDevCommand
)

if (!existsSync(resolve('./frontend/src/modules/settings.ts')))
    copyFileSync(
        resolve('./cli/sample/docker_dev_frontend_settings.ts'),
        resolve('./frontend/src/modules/settings.ts')
    )

const feDockerFile = readFileSync(resolve('./frontend/Dockerfile')).toString()

const feDevCommand = `
ENTRYPOINT ["npm", "run"]
CMD ["dev"]
`

writeFileSync(
    resolve('./frontend/DockerfileDev'),
    feDockerFile.split('RUN npm run build')[0] + feDevCommand
)

spawn('docker-compose', [
    '-p',
    'blex_dev',
    '-f',
    resolve('docker-compose.dev.yml'),
    'up',
    '--build'
], {
    stdio: 'inherit'
})