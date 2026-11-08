import path from 'path'
import * as fs from 'node:fs'
import { app } from 'electron'
import * as runServer from './server-runner'
import log from 'electron-log/main'

import * as settings from '../settings'
import { phpantomTarget } from './phpantom-config.js'

const resolvePhpantomBinary = (): string | null => {
  const target = phpantomTarget(process.platform, process.arch)
  if (!target) return null

  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'phpantom')
    : path.join(app.getAppPath(), 'phpantom-bin')

  const binaryPath = path.join(base, target.triple, target.binary)

  return fs.existsSync(binaryPath) ? binaryPath : null
}

const runPhpantom = async (serverPort: number): Promise<boolean> => {
  const binary = resolvePhpantomBinary()
  if (!binary) {
    log.error(
      `PHPantom binary not found for ${process.platform}/${process.arch}; falling back to Intelephense. Run "npm run update-phpantom" in development, or rebuild the app.`
    )
    return false
  }

  console.log('Initiating PHP language server (PHPantom)')

  try {
    // PHPantom is a single static binary speaking LSP over stdio; spawn it
    // directly with no env tricks or initialization requirements.
    await runServer.runLanguageServer({
      serverName: 'PHPantom',
      pathName: '/',
      serverPort,
      runCommand: binary,
      runCommandArgs: [],
      wsServerOptions: {
        noServer: true,
        perMessageDeflate: false,
      },
    })
    return true
  } catch (error) {
    log.error('Error starting PHPantom language server', error)
    return false
  }
}

export const init = async () => {
  const serverPort = Number(process.env.VITE_LSP_WEBSOCKET_PORT || 54331)

  if (settings.getSettings().languageServer === 'phpantom' && (await runPhpantom(serverPort))) {
    return
  }

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
