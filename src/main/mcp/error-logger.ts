/**
 * MCP Error Logger
 * Centralized error logging for MCP server operations
 */

import * as fs from 'fs'
import * as path from 'path'
import { settingsDir } from '../settings'
import { MCPError, MCPErrorCode } from './types'
import { getLogPath, cleanOldLogs } from '../utils/logger.ts'

export interface ErrorLogEntry {
  timestamp: string
  errorCode: MCPErrorCode
  message: string
  details?: Record<string, unknown>
  tool?: string
  stackTrace?: string
}

export class ErrorLogger {
  private maxLogSize: number = 10 * 1024 * 1024 // 10MB
  private rotationCount: number = 5

  constructor() {
    // Store logs in settings directory
    const logsDir = path.join(settingsDir, 'logs')

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true })
    }

    // Clean old logs older than 7 days
    cleanOldLogs(logsDir, 7)
  }

  /**
   * Log an error to the MCP server log file
   */
  logError(error: MCPError, tool?: string, stackTrace?: string): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      errorCode: error.code as MCPErrorCode,
      message: error.message,
      details: this.sanitizeDetails(error.details),
      tool,
      stackTrace,
    }

    this.writeLogEntry(entry)
  }

  /**
   * Log a general message (for non-error events)
   */
  logInfo(message: string, details?: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      details: this.sanitizeDetails(details),
    }

    this.writeLogEntry(entry)
  }

  /**
   * Log a warning message
   */
  logWarning(message: string, details?: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'WARNING',
      message,
      details: this.sanitizeDetails(details),
    }

    this.writeLogEntry(entry)
  }

  /**
   * Write a log entry to the file
   */
  private writeLogEntry(entry: any): void {
    try {
      const filePath = this.getLogFilePath()
      // Check if log rotation is needed
      this.rotateLogsIfNeeded(filePath)

      // Format the log entry as JSON line
      const logLine = JSON.stringify(entry) + '\n'

      // Append to log file
      fs.appendFileSync(filePath, logLine, 'utf8')
    } catch (err) {
      // If logging fails, write to console as fallback
      console.error('Failed to write to MCP log file:', err)
      console.error('Log entry:', entry)
    }
  }

  /**
   * Rotate logs if the current log file exceeds max size
   */
  private rotateLogsIfNeeded(targetPath?: string): void {
    try {
      const filePath = targetPath || this.getLogFilePath()
      if (!fs.existsSync(filePath)) {
        return
      }

      const stats = fs.statSync(filePath)
      if (stats.size < this.maxLogSize) {
        return
      }

      // Rotate existing logs
      for (let i = this.rotationCount - 1; i > 0; i--) {
        const oldPath = `${filePath}.${i}`
        const newPath = `${filePath}.${i + 1}`

        if (fs.existsSync(oldPath)) {
          if (i === this.rotationCount - 1) {
            // Delete the oldest log
            fs.unlinkSync(oldPath)
          } else {
            fs.renameSync(oldPath, newPath)
          }
        }
      }

      // Rotate current log to .1
      fs.renameSync(filePath, `${filePath}.1`)
    } catch (err) {
      console.error('Failed to rotate MCP log files:', err)
    }
  }

  /**
   * Sanitize log details to remove sensitive information
   */
  private sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!details) {
      return undefined
    }

    const sanitized = { ...details }

    // List of sensitive keys to redact
    const sensitiveKeys = [
      'password',
      'privateKey',
      'passphrase',
      'auth_token',
      'apiKey',
      'api_key',
      'secret',
      'token',
      'authorization',
    ]

    // Recursively sanitize nested objects
    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject)
      }

      const result: any = {}
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase()
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
          result[key] = '[REDACTED]'
        } else {
          result[key] = sanitizeObject(value)
        }
      }
      return result
    }

    return sanitizeObject(sanitized)
  }

  /**
   * Get the path to the current log file
   */
  getLogFilePath(): string {
    return getLogPath(settingsDir, new Date(), 'mcp-server')
  }

  /**
   * Read recent log entries
   */
  getRecentLogs(count: number = 100): ErrorLogEntry[] {
    try {
      const filePath = this.getLogFilePath()
      if (!fs.existsSync(filePath)) {
        return []
      }

      const content = fs.readFileSync(filePath, 'utf8')
      const lines = content.trim().split('\n')

      // Get the last N lines
      const recentLines = lines.slice(-count)

      // Parse JSON lines
      return recentLines
        .map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        })
        .filter(entry => entry !== null)
    } catch (err) {
      console.error('Failed to read MCP log file:', err)
      return []
    }
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    try {
      const filePath = this.getLogFilePath()
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }

      // Remove rotated logs
      for (let i = 1; i <= this.rotationCount; i++) {
        const rotatedPath = `${filePath}.${i}`
        if (fs.existsSync(rotatedPath)) {
          fs.unlinkSync(rotatedPath)
        }
      }
    } catch (err) {
      console.error('Failed to clear MCP log files:', err)
    }
  }
}

// Singleton instance
let loggerInstance: ErrorLogger | null = null

export function getErrorLogger(): ErrorLogger {
  if (!loggerInstance) {
    loggerInstance = new ErrorLogger()
  }
  return loggerInstance
}
