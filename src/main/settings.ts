import path from 'path'
import * as fs from 'node:fs'
import { app } from 'electron'
import { Settings } from '../types/settings.type'
import os from 'os'
import { isWindows } from './system/platform.ts'
import { execSync } from 'child_process'

const homeDir = os.homedir()

export const settingsDir = app.isPackaged ? path.join(homeDir, '.tweakphp') : path.join(homeDir, '.tweakphp_dev')

if (!fs.existsSync(settingsDir)) {
  fs.mkdirSync(settingsDir, { recursive: true })
}
const laravelPath = path.join(settingsDir, 'laravel')
export const settingsPath = path.join(settingsDir, 'settings.json')
const DEFAULT_DOCKER_KUBECTL_EXECUTION_TIMEOUT_SECONDS = 60
const MIN_DOCKER_KUBECTL_EXECUTION_TIMEOUT_SECONDS = 1
const MAX_DOCKER_KUBECTL_EXECUTION_TIMEOUT_SECONDS = 3600

export const normalizeDockerKubectlExecutionTimeoutSeconds = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_DOCKER_KUBECTL_EXECUTION_TIMEOUT_SECONDS

  return Math.min(
    MAX_DOCKER_KUBECTL_EXECUTION_TIMEOUT_SECONDS,
    Math.max(MIN_DOCKER_KUBECTL_EXECUTION_TIMEOUT_SECONDS, Math.round(parsed))
  )
}

const defaultSettings: Settings = {
  version: app.getVersion(),
  laravelPath: laravelPath,
  php: '',
  theme: 'dracula',
  editorFontSize: 15,
  editorWordWrap: 'on',
  layout: 'vertical',
  output: 'code',
  vimMode: 'off',
  stackedDump: 'extended',
  windowWidth: 1100,
  windowHeight: 700,
  intelephenseLicenseKey: '' as any,
  aiStatus: false,
  aiProvider: null,
  aiModelId: null,
  aiApiKey: null,
  aiPromptTemplateGenerateCodeFromComment: '',
  aiPromptTemplateCompleteComment: '',
  aiPromptTemplateCompleteCode: '',
  navigationDisplay: 'collapsed',
  mcpEnabled: false,
  mcpPort: 3000,
  streaming: true,
  dockerKubectlExecutionTimeoutSeconds: DEFAULT_DOCKER_KUBECTL_EXECUTION_TIMEOUT_SECONDS,
}

export const setSettings = (data: Settings) => {
  data.dockerKubectlExecutionTimeoutSeconds = normalizeDockerKubectlExecutionTimeoutSeconds(
    data.dockerKubectlExecutionTimeoutSeconds
  )
  const tmpPath = `${settingsPath}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(data))
  fs.renameSync(tmpPath, settingsPath)
}

export const getSettings = () => {
  let settingsRaw: string = ''
  let settings: Settings

  if (fs.existsSync(settingsPath)) {
    settingsRaw = fs.readFileSync(settingsPath).toString()
  }

  if (settingsRaw) {
    let settingsJson: any
    try {
      settingsJson = JSON.parse(settingsRaw)
    } catch (error) {
      console.error('Failed to parse settings.json, resetting to default settings', error)
      settings = { ...defaultSettings }
      try {
        setSettings(settings)
      } catch (writeError) {
        console.error('Failed to reset settings.json', writeError)
      }
      return settings
    }
    settings = {
      version: defaultSettings.version,
      laravelPath: defaultSettings.laravelPath,
      php: settingsJson.php || defaultSettings.php,
      theme: settingsJson.theme || defaultSettings.theme,
      editorFontSize: settingsJson.editorFontSize || defaultSettings.editorFontSize,
      editorWordWrap: settingsJson.editorWordWrap || defaultSettings.editorWordWrap,
      layout: settingsJson.layout || defaultSettings.layout,
      output: settingsJson.output || defaultSettings.output,
      vimMode: settingsJson.vimMode || defaultSettings.vimMode,
      stackedDump: settingsJson.stackedDump || defaultSettings.stackedDump,
      windowWidth: settingsJson.windowWidth || defaultSettings.windowWidth,
      windowHeight: settingsJson.windowHeight || defaultSettings.windowHeight,
      intelephenseLicenseKey: settingsJson.intelephenseLicenseKey || '',
      aiStatus: settingsJson.aiStatus || defaultSettings.aiStatus,
      aiProvider: settingsJson.aiProvider || null,
      aiModelId: settingsJson.aiModelId || null,
      aiApiKey: settingsJson.aiApiKey || null,
      aiPromptTemplateGenerateCodeFromComment:
        settingsJson.aiPromptTemplateGenerateCodeFromComment !== undefined
          ? settingsJson.aiPromptTemplateGenerateCodeFromComment
          : '',
      aiPromptTemplateCompleteComment:
        settingsJson.aiPromptTemplateCompleteComment !== undefined ? settingsJson.aiPromptTemplateCompleteComment : '',
      aiPromptTemplateCompleteCode:
        settingsJson.aiPromptTemplateCompleteCode !== undefined ? settingsJson.aiPromptTemplateCompleteCode : '',
      navigationDisplay: settingsJson.navigationDisplay || defaultSettings.navigationDisplay,
      mcpEnabled: settingsJson.mcpEnabled ?? defaultSettings.mcpEnabled,
      mcpPort: settingsJson.mcpPort || defaultSettings.mcpPort,
      streaming: settingsJson.streaming !== undefined ? settingsJson.streaming : defaultSettings.streaming,
      dockerKubectlExecutionTimeoutSeconds: normalizeDockerKubectlExecutionTimeoutSeconds(
        settingsJson.dockerKubectlExecutionTimeoutSeconds
      ),
    }
    if (
      settingsJson.version !== defaultSettings.version ||
      settingsJson.laravelPath !== defaultSettings.laravelPath ||
      settingsJson.dockerKubectlExecutionTimeoutSeconds !== settings.dockerKubectlExecutionTimeoutSeconds
    ) {
      setSettings(settings)
    }
  } else {
    settings = defaultSettings
    setSettings(settings)
  }

  return settings
}

export const detectPhpPaths = (): string[] => {
  const pathsSet = new Set<string>()

  try {
    const cmd = isWindows() ? 'where php' : 'which -a php'
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    if (out) {
      out.split(/\r?\n/).forEach(p => {
        const cleaned = p.trim()
        if (cleaned && fs.existsSync(cleaned)) {
          pathsSet.add(cleaned)
        }
      })
    }
  } catch (e) {}

  if (isWindows()) {
    const userHome = os.homedir()
    const commonPaths = [
      'C:\\php\\php.exe',
      'C:\\xampp\\php\\php.exe',
      path.join(userHome, 'AppData', 'Local', 'Herd', 'bin', 'php.exe'),
    ]

    const laragonPhpDir = 'C:\\laragon\\bin\\php'
    try {
      if (fs.existsSync(laragonPhpDir)) {
        const subdirs = fs.readdirSync(laragonPhpDir)
        subdirs.forEach(dir => {
          const p = path.join(laragonPhpDir, dir, 'php.exe')
          if (fs.existsSync(p)) {
            pathsSet.add(p)
          }
        })
      }
    } catch (e) {}

    commonPaths.forEach(p => {
      if (fs.existsSync(p)) {
        pathsSet.add(p)
      }
    })

    try {
      const out = execSync('wsl -l -q', { encoding: 'utf16le', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 })
      let distrosStr = out.toString()
      if (distrosStr.includes('\u0000')) {
        distrosStr = distrosStr.replace(/\u0000/g, '')
      }
      const distros = distrosStr
        .split(/\r?\n/)
        .map(d => d.trim())
        .filter(Boolean)
        .filter(d => !d.toLowerCase().includes('docker'))

      for (const distro of distros) {
        try {
          const wslPhp = execSync(`wsl -d ${distro} which php`, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 1500,
          }).trim()
          if (wslPhp && !wslPhp.includes('not found') && wslPhp.startsWith('/')) {
            const uncPath = `\\\\wsl.localhost\\${distro}${wslPhp.replace(/\//g, '\\')}`
            pathsSet.add(uncPath)
          }
        } catch (e) {}
      }
    } catch (e) {}
  } else {
    const commonPaths = ['/usr/bin/php', '/usr/local/bin/php', '/opt/homebrew/bin/php']
    commonPaths.forEach(p => {
      if (fs.existsSync(p)) {
        pathsSet.add(p)
      }
    })
  }

  return Array.from(pathsSet)
}
