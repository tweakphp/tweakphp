import * as runServer from './server-runner'
import log from 'electron-log/main'

import * as settings from '../settings'

export const init = async () => {
  console.log('Initiating PHP language server (Intelephense)')

  let intelephenseEntry = ''
  try {
    intelephenseEntry = require.resolve('intelephense')
  } catch (e) {
    return
  }

  try {
    await runServer.runLanguageServer({
      serverName: 'Intelephense',
      pathName: '/',
      serverPort: Number(process.env.VITE_LSP_WEBSOCKET_PORT || 54331),
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
  }
}

export const shutdown = async () => {
  console.log('Shutting down PHP language server')
  await runServer.shutdown()
}
