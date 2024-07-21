import { resolve } from 'node:path'
import { runLanguageServer } from './server-runner.js'
import { getLocalDirectory } from './server-commons.js'

const processRunPath = resolve(getLocalDirectory(import.meta.url), getLocalDirectory(import.meta.url))

export const init = () => {
    runLanguageServer({
        serverName: 'PHP',
        pathName: '/',
        serverPort: 8080,
        runCommand: '/Users/saeed/Desktop/phpactor/bin/phpactor',
        runCommandArgs: ['language-server'],
        wsServerOptions: {
            noServer: true,
            perMessageDeflate: false,
        },
    })
}
