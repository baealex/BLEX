import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { copySampleData, runScript } from './core'

const options = process.argv.slice(2)

copySampleData()

const beDockerFile = readFileSync(resolve('./backend/Dockerfile')).toString()

const beDevCommand = `
ENTRYPOINT ["python", "manage.py"]
CMD ["runserver", "0.0.0.0:9000"]
`

writeFileSync(
    resolve('./backend/DockerfileDev'),
    beDockerFile.split('ENTRYPOINT')[0] + beDevCommand
)

const feDockerFile = readFileSync(resolve('./frontend/Dockerfile')).toString()

const feDevCommand = `
ENTRYPOINT ["npm", "run"]
CMD ["dev"]
`

writeFileSync(
    resolve('./frontend/DockerfileDev'),
    feDockerFile.split('ENTRYPOINT')[0] + feDevCommand
)

runScript('dev', options)
