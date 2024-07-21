import { URL } from 'node:url'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    WebSocketMessageReader,
    WebSocketMessageWriter,
} from 'vscode-ws-jsonrpc'
import {
    createConnection,
    createServerProcess,
    forward,
} from 'vscode-ws-jsonrpc/server'
import { Message, InitializeRequest } from 'vscode-languageserver'

/**
 * start the language server inside the current process
 */
export const launchLanguageServer = (runconfig, socket) => {
    const { serverName, runCommand, runCommandArgs, spawnOptions } = runconfig
    console.log(
        `Starting ${serverName} with command: ${runCommand} ${runCommandArgs.join(' ')}`
    )

    const reader = new WebSocketMessageReader(socket)
    const writer = new WebSocketMessageWriter(socket)
    const socketConnection = createConnection(reader, writer, () =>
        socket.dispose()
    )
    const serverConnection = createServerProcess(
        serverName,
        runCommand,
        runCommandArgs,
        spawnOptions
    )
    if (serverConnection) {
        forward(socketConnection, serverConnection, message => {
            if (Message.isRequest(message)) {
                console.log(`${serverName} Server received a request`)
                if (message.method === InitializeRequest.type.method) {
                    const initializeParams = message.params
                    initializeParams.processId = process.pid
                }
            }
            if (message.method === 'textDocument/didChange') {
                console.log(message.params)
            }
            if (Message.isResponse(message)) {
                console.log(`${serverName} Server sent a response`)
            }
            return message
        })
    } else {
        console.error(
            `Failed to start ${serverName} with command: ${runCommand} ${runCommandArgs.join(' ')}`
        )
    }
}
export const upgradeWsServer = (runconfig, config) => {
    config.server.on('upgrade', (request, socket, head) => {
        const baseURL = `http://${request.headers.host}/`
        const pathName =
            request.url !== undefined
                ? new URL(request.url, baseURL).pathname
                : undefined
        if (pathName === runconfig.pathName) {
            config.wss.handleUpgrade(request, socket, head, webSocket => {
                const socket = {
                    send: content =>
                        webSocket.send(content, error => {
                            if (error) {
                                throw error
                            }
                        }),
                    onMessage: cb =>
                        webSocket.on('message', data => {
                            cb(data)
                        }),
                    onError: cb => webSocket.on('error', cb),
                    onClose: cb => webSocket.on('close', cb),
                    dispose: () => webSocket.close(),
                }
                // launch the server when the web socket is opened
                if (webSocket.readyState === webSocket.OPEN) {
                    launchLanguageServer(runconfig, socket)
                } else {
                    webSocket.on('open', () => {
                        launchLanguageServer(runconfig, socket)
                    })
                }
            })
        }
    })
}

/**
 * Solves: __dirname is not defined in ES module scope
 */
export const getLocalDirectory = referenceUrl => {
    const __filename = fileURLToPath(referenceUrl)
    return dirname(__filename)
}
