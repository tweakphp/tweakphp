import { URL } from 'node:url'
import { WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc'
import { createConnection, forward, createProcessStreamConnection } from 'vscode-ws-jsonrpc/server'
import { Message, InitializeRequest } from 'vscode-languageserver'
import log from 'electron-log/main'
import cp from 'child_process'
import { RunConfig } from '../../types/run-config.type'
import { WebSocket } from 'ws'

let serverProcess: cp.ChildProcess | null = null

export const launchLanguageServer = async (runconfig: RunConfig, socket: any) => {
  const { serverName, runCommand, runCommandArgs, spawnOptions } = runconfig
  log.info(`Starting ${serverName} with command: ${runCommand} ${runCommandArgs.join(' ')}`)

  const reader = new WebSocketMessageReader(socket)
  const writer = new WebSocketMessageWriter(socket)
  const socketConnection = createConnection(reader, writer, () => socket.dispose())

  const serverConnection = createServerProcess(serverName, runCommand, runCommandArgs, spawnOptions)
  if (serverConnection) {
    forward(socketConnection, serverConnection, message => {
      if (Message.isRequest(message)) {
        if (message.method === InitializeRequest.type.method) {
          const initializeParams = message.params as { processId: number }
          initializeParams.processId = process.pid
        }
      }
      return message
    })
  } else {
    log.error(`Failed to start ${serverName} with command: ${runCommand} ${runCommandArgs.join(' ')}`)
  }
}

export function createServerProcess(serverName: string, command: string, args: string[], options?: cp.SpawnOptions) {
  if (serverProcess !== null) {
    serverProcess.kill()
  }
  serverProcess = cp.spawn(`"${command}"`, args || [], options || {})
  serverProcess.on('error', error => console.error(`Launching ${serverName} Server failed: ${error}`))
  if (serverProcess.stderr !== null) {
    serverProcess.stderr.on('data', data => console.error(`${serverName} Server: ${data}`))
  }
  return createProcessStreamConnection(serverProcess)
}

export const upgradeWsServer = (runconfig: RunConfig, config: any) => {
  config.server.on('upgrade', (request: import('http').IncomingMessage, socket: import('net').Socket, head: Buffer) => {
    const baseURL = `http://${request.headers.host}/`
    const pathName = request.url !== undefined ? new URL(request.url, baseURL).pathname : undefined
    if (pathName === runconfig.pathName) {
      config.wss.handleUpgrade(request, socket, head, (webSocket: WebSocket) => {
        const socket = {
          send: (content: any) => webSocket.send(content),
          onMessage: (cb: (data: any) => void) =>
            webSocket.on('message', data => {
              cb(data)
            }),
          onError: (cb: (err: Error) => void) => webSocket.on('error', cb),
          onClose: (cb: () => void) => webSocket.on('close', cb),
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
