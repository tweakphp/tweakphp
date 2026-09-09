import * as runServer from './server-runner'
import { killServerProcess } from './server-commons'
import log from 'electron-log/main'

import * as settings from '../settings'
import { LSP_WEBSOCKET_DEFAULT_PORT } from '../constants'

export const init = async (): Promise<boolean> => {
  console.log('Initiating PHP language server (Intelephense)')

  let intelephenseEntry = ''
  try {
    intelephenseEntry = require.resolve('intelephense')
  } catch (e) {
    log.error('Intelephense is not available: PHP language server cannot start')
    return false
  }

  const envPort = Number(process.env.VITE_LSP_WEBSOCKET_PORT)
  const serverPort = Number.isFinite(envPort) && envPort > 0 ? envPort : LSP_WEBSOCKET_DEFAULT_PORT

  try {
    await runServer.runLanguageServer({
      serverName: 'Intelephense',
      pathName: '/',
      serverPort,
      runCommand: process.execPath,
      runCommandArgs: [intelephenseEntry, '--stdio'],
      spawnOptions: {
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          INTELEPHENSE_TELEMETRY_ENABLED: '0',
          ...(settings.getSettings().intelephenseLicenseKey
            ? { INTELEPHENSE_LICENSE_KEY: settings.getSettings().intelephenseLicenseKey }
            : {}),
        },
        shell: true,
      },
      wsServerOptions: {
        noServer: true,
        perMessageDeflate: false,
      },
    })
  } catch (error) {
    log.error('Error starting PHP language server', error)
    return false
  }

  return true
}

export const shutdown = async () => {
  console.log('Shutting down PHP language server')
  await runServer.shutdown()
  killServerProcess()
}
