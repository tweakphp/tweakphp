import { runLanguageServer } from './server-runner.js'
import { exec } from 'child_process'

export const init = async () => {
    await freePort(process.env.VITE_LSP_WEBSOCKET_PORT)

    await runLanguageServer({
        serverName: 'PHP',
        pathName: '/',
        serverPort: process.env.VITE_LSP_WEBSOCKET_PORT,
        runCommand: process.env.LSP_EXECUTABLE_PATH,
        runCommandArgs: ['language-server'],
        wsServerOptions: {
            noServer: true,
            perMessageDeflate: false,
        },
    })
}

const freePort = (port) => {
    return new Promise((resolve) => {
        exec(`lsof -i :${port} -t`, (err, stdout) => {
            const pid = stdout.trim()
            if (pid) {
                exec(`kill ${pid}`, () => {
                    resolve()
                })
            } else {
                resolve()
            }
        })
    })
}
