import { WebSocketServer } from 'ws'
import express from 'express'
import { upgradeWsServer } from './server-commons'
import { Server } from 'http'
import { RunConfig } from '../../types/run-config.type'

let httpServer: Server | null = null

export const runLanguageServer = async (languageServerRunConfig: RunConfig) => {
  const app = express()

  await shutdown()

  try {
    // start the http server
    httpServer = app.listen(languageServerRunConfig.serverPort)
    const wss = new WebSocketServer(languageServerRunConfig.wsServerOptions)
    // create the web socket
    upgradeWsServer(languageServerRunConfig, {
      server: httpServer,
      wss,
    })
  } catch (error) {
    console.error('Error starting language server', error)
  }
}

export const shutdown = async () => {
  if (httpServer) {
    httpServer.close()
  }
}
