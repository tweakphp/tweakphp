import { WebSocketServer } from 'ws'
import express from 'express'
import { upgradeWsServer } from './server-commons'
import { Server } from 'http'
import { RunConfig } from '../../types/run-config.type'

let httpServer: Server | null = null

export const runLanguageServer = async (languageServerRunConfig: RunConfig) => {
  const app = express()

  await shutdown()

  const server = app.listen(languageServerRunConfig.serverPort)
  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error('Error starting language server', error)
  })

  httpServer = server

  // create the web socket
  const wss = new WebSocketServer(languageServerRunConfig.wsServerOptions)
  upgradeWsServer(languageServerRunConfig, {
    server,
    wss,
  })
}

export const shutdown = async () => {
  if (!httpServer) {
    return
  }
  const server = httpServer
  httpServer = null
  await new Promise<void>(resolve => {
    server.close(() => resolve())
    server.closeAllConnections()
    setTimeout(() => resolve(), 5000)
  })
}
