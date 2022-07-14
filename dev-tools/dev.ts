import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { runScript } from './core'

if (!existsSync(resolve('./backend/.env')))
    copyFileSync(
        resolve('./dev-tools/sample/backend/.env'),
        resolve('./backend/.env')
    )

if (!existsSync(resolve('./backend/src/db.sqlite3')))
    copyFileSync(
        resolve('./dev-tools/sample/db.sqlite3'),
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

if (!existsSync(resolve('./frontend/.env')))
    copyFileSync(
        resolve('./dev-tools/sample/frontend/.env'),
        resolve('./frontend/.env')
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

runScript('development')