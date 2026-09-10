import { WebSocketServer } from 'ws'
import express from 'express'
import { upgradeWsServer } from './server-commons'
import { Server } from 'http'
import { RunConfig } from '../../types/run-config.type'
import { SERVER_CLOSE_TIMEOUT_MS } from '../constants'

let httpServer: Server | null = null

export const runLanguageServer = async (languageServerRunConfig: RunConfig) => {
  const app = express()

  await shutdown()

  const server = app.listen(languageServerRunConfig.serverPort)
  httpServer = server

  // Surface listen failures (e.g. EADDRINUSE) to the caller instead of
  // leaving a broken server registered in the module state
  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve())
    server.once('error', (error: NodeJS.ErrnoException) => {
      httpServer = null
      reject(error)
    })
  })

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
    setTimeout(() => resolve(), SERVER_CLOSE_TIMEOUT_MS)
  })
}
