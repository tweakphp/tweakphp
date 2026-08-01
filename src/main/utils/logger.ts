import path from 'path'
import * as fs from 'fs'

/**
 * Formats a Date object into YYYY-MM-DD string.
 */
export const formatDate = (date: Date = new Date()): string => {
  return date.toISOString().split('T')[0]
}

/**
 * Returns the full file path for the log file of a given date and prefix.
 */
export const getLogPath = (baseDir: string, date: Date = new Date(), prefix: string = 'main'): string => {
  const dateStr = formatDate(date)
  return path.join(baseDir, 'logs', `${prefix}-${dateStr}.log`)
}

/**
 * Deletes files matching *.log in the specified directory that are older than maxDays.
 * Returns the list of deleted file paths.
 */
export const cleanOldLogs = (logsDir: string, maxDays: number = 7, referenceTimeMs: number = Date.now()): string[] => {
  const deletedFiles: string[] = []
  try {
    if (!fs.existsSync(logsDir)) return deletedFiles

    const files = fs.readdirSync(logsDir)
    const maxAgeMs = maxDays * 24 * 60 * 60 * 1000

    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(logsDir, file)
        const stats = fs.statSync(filePath)
        if (referenceTimeMs - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath)
          deletedFiles.push(filePath)
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning old log files:', error)
  }

  return deletedFiles
}

/**
 * Configures the logger file transport and performs cleanup of old log files.
 */
export const initLogger = (log: any, settingsDir: string, maxDays: number = 7) => {
  const logsDir = path.join(settingsDir, 'logs')
  log.transports.file.resolvePathFn = () => getLogPath(settingsDir)
  cleanOldLogs(logsDir, maxDays)
}
