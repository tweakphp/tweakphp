import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import { formatDate, getLogPath, cleanOldLogs, initLogger } from './logger'

describe('Logger Utils (logger.ts)', () => {
  const mockBaseDir = '/mock/settings'

  describe('formatDate', () => {
    it('formats a date to YYYY-MM-DD string', () => {
      const testDate = new Date('2026-07-29T12:00:00Z')
      expect(formatDate(testDate)).toBe('2026-07-29')
    })
  })

  describe('getLogPath', () => {
    it('returns the full log path with the date in filename', () => {
      const testDate = new Date('2026-07-29T12:00:00Z')
      const result = getLogPath(mockBaseDir, testDate)
      expect(result).toBe(path.join(mockBaseDir, 'logs', 'main-2026-07-29.log'))
    })

    it('supports custom file prefix', () => {
      const testDate = new Date('2026-07-29T12:00:00Z')
      const result = getLogPath(mockBaseDir, testDate, 'mcp-server')
      expect(result).toBe(path.join(mockBaseDir, 'logs', 'mcp-server-2026-07-29.log'))
    })
  })

  describe('cleanOldLogs', () => {
    const testDir = path.join(__dirname, 'test-logs-tmp')

    beforeEach(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true })
      }
    })

    afterEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true })
      }
    })

    it('returns empty array if directory does not exist', () => {
      const nonExistentDir = path.join(__dirname, 'non-existent-dir-xyz')
      expect(cleanOldLogs(nonExistentDir, 7)).toEqual([])
    })

    it('deletes log files older than maxDays and preserves newer log files', () => {
      const now = Date.now()
      const oneDayMs = 24 * 60 * 60 * 1000

      const fileRecent = path.join(testDir, 'main-2026-07-29.log')
      const file5DaysOld = path.join(testDir, 'main-2026-07-24.log')
      const file10DaysOld = path.join(testDir, 'main-2026-07-19.log')
      const nonLogFile = path.join(testDir, 'other.txt')

      fs.writeFileSync(fileRecent, 'recent log')
      fs.writeFileSync(file5DaysOld, '5 days old log')
      fs.writeFileSync(file10DaysOld, '10 days old log')
      fs.writeFileSync(nonLogFile, 'some text')

      // Set modification times
      fs.utimesSync(fileRecent, now / 1000, now / 1000)
      fs.utimesSync(file5DaysOld, (now - 5 * oneDayMs) / 1000, (now - 5 * oneDayMs) / 1000)
      fs.utimesSync(file10DaysOld, (now - 10 * oneDayMs) / 1000, (now - 10 * oneDayMs) / 1000)
      fs.utimesSync(nonLogFile, (now - 15 * oneDayMs) / 1000, (now - 15 * oneDayMs) / 1000)

      const deleted = cleanOldLogs(testDir, 7, now)

      expect(deleted).toContain(file10DaysOld)
      expect(deleted).not.toContain(fileRecent)
      expect(deleted).not.toContain(file5DaysOld)
      expect(deleted).not.toContain(nonLogFile)

      expect(fs.existsSync(fileRecent)).toBe(true)
      expect(fs.existsSync(file5DaysOld)).toBe(true)
      expect(fs.existsSync(file10DaysOld)).toBe(false)
      expect(fs.existsSync(nonLogFile)).toBe(true)
    })
  })

  describe('initLogger', () => {
    it('sets resolvePathFn on electron-log transport and triggers cleanup', () => {
      const mockLog = {
        transports: {
          file: {
            resolvePathFn: null as any,
          },
        },
      }

      initLogger(mockLog, mockBaseDir, 7)

      expect(typeof mockLog.transports.file.resolvePathFn).toBe('function')
      const computedPath = mockLog.transports.file.resolvePathFn()
      const today = new Date().toISOString().split('T')[0]
      expect(computedPath).toBe(path.join(mockBaseDir, 'logs', `main-${today}.log`))
    })
  })
})
