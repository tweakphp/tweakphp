import path from 'path'
import { exec } from 'child_process'
import { app, ipcMain } from 'electron'
import * as settings from './settings'
import * as php from './php'
import { DOCKER_PATH } from './docker.ts'

export const init = async () => {
  ipcMain.on('client.local.execute', localExec)
  ipcMain.on('client.local.info', info)
  ipcMain.on('client.docker.execute', dockerExec)
}

export function getLocalPharClient() {
  const phpVersion = php.getVersion(settings.getSettings().php)
  if (app.isPackaged) {
    return path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
  }

  if (process.env.CLIENT_PATH) {
    return process.env.CLIENT_PATH
  }

  return path.join(__dirname, `../public/client-${phpVersion}.phar`)
}

export const dockerExec = async (
  event: Electron.IpcMainEvent,
  data: { code: string; php: string; path: string; phar_client: string; container_id: string }
) => {
  const phpPath = `"${data.php}"`
  const path = `"${data.path}"`
  const code = btoa(data.code.replaceAll('<?php', ''))

  const pharClient = `"${data.phar_client}"`

  const command = `${DOCKER_PATH} exec ${data.container_id} ${phpPath} ${pharClient} ${path} execute ${code}`

  await execute(event, command)
}

export const localExec = async (event: Electron.IpcMainEvent, data: { code: string; php: string; path: string }) => {
  const phpPath = `"${data.php}"`
  const path = `"${data.path}"`
  const code = btoa(data.code.replaceAll('<?php', ''))

  const command = `${phpPath} ${getLocalPharClient()} ${path} execute ${code}`

  await execute(event, command)
}

export const execute = async (event: Electron.IpcMainEvent, command: string) => {
  exec(command, (stdout, stderr) => {
    let result: string = ''

    if (stderr) {
      result += stderr
      event.reply('client.execute.reply', result)
      return
    }

    result += stdout
    result = result.trim()

    if (result.startsWith('"') && result.endsWith('"')) {
      result = result.slice(1, -1)
    }

    event.reply('client.execute.reply', result)
  })
}

export const info = async (event: Electron.IpcMainEvent, data: { php: string; path: string }) => {
  exec(`"${data.php}" ${getLocalPharClient()} ${data.path} info`, (error, stdout) => {
    if (error) {
      event.reply('client.info.reply', error.message)
      return
    }
    event.reply('client.info.reply', stdout?.replaceAll('\n', ''))
  })
}
