import fs from 'fs'
import { Settings } from '../types/settings.type'
import { getSettings, settingsPath } from './settings'
import { app, BrowserWindow } from 'electron'
import path from 'path'
import AdmZip from 'adm-zip'

export const init = async (window: BrowserWindow) => {
  let forceExtract = false
  try {
    if (fs.existsSync(settingsPath)) {
      const settingsJson = JSON.parse(fs.readFileSync(settingsPath).toString())
      if (settingsJson.version && settingsJson.version !== app.getVersion()) {
        forceExtract = true
      }
    }
  } catch (e) {
    // Ignore error
  }

  const settings: Settings = getSettings()

  if (fs.existsSync(settings.laravelPath)) {
    if (forceExtract) {
      console.log('App version changed. Clearing old default laravel directory...')
      fs.rmSync(settings.laravelPath, { recursive: true, force: true })
    } else {
      return
    }
  }

  const zipPath = app.isPackaged
    ? path.join(process.resourcesPath, 'public/laravel.zip')
    : path.join(__dirname, '../public/laravel.zip')

  if (!fs.existsSync(zipPath)) {
    console.error(`ZIP file not found: ${zipPath}`)
    return
  }

  const zip = new AdmZip(zipPath)
  const zipEntries = zip.getEntries()
  const totalFiles = zipEntries.length
  const targetDir = path.resolve(settings.laravelPath)

  let lastProgressEvent = 0
  for (let i = 0; i < totalFiles; i++) {
    const entry = zipEntries[i]
    if (!entry.isDirectory) {
      const relativePath = entry.entryName.replace(/^laravel\//, '')
      const entryPath = path.join(settings.laravelPath, relativePath)

      const containmentPath = path.relative(targetDir, path.resolve(entryPath))
      if (containmentPath.startsWith('..') || path.isAbsolute(containmentPath)) {
        continue
      }

      fs.mkdirSync(path.dirname(entryPath), { recursive: true })

      fs.writeFileSync(entryPath, entry.getData())
    }

    const progress = (i + 1) / totalFiles
    const progressPercentage = Math.floor(progress * 100)

    if (progressPercentage >= lastProgressEvent + 10) {
      lastProgressEvent = progressPercentage

      window.setProgressBar(progressPercentage / 100)

      window.webContents.send('statusbar.progress', {
        progress: progressPercentage,
        title: 'Extracting Laravel.zip',
      })
    }
  }

  console.log(`Extracted ${zipPath} to ${settings.laravelPath}`)

  window.setProgressBar(-1)
}
