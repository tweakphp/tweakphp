import * as runServer from './server-runner'
import log from 'electron-log/main'
import path from 'path'
import { app } from 'electron'
import * as settings from '../settings'

export const init = async () => {
  const lspPath = app.isPackaged
    ? path.join(process.resourcesPath, 'public/phpactor.phar')
    : path.join(__dirname, '/../public/phpactor.phar')

  console.log('Initiating PHP language server')

  if (!settings.getSettings().php) {
    log.error('PHP executable not found in settings')
    return
  }

  try {
    await runServer.runLanguageServer({
      serverName: 'PHP',
      pathName: '/',
      serverPort: 54331,
      runCommand: settings.getSettings().php,
      runCommandArgs: [lspPath, 'language-server'],
      spawnOptions: {
        env: {
          ...process.env,
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
