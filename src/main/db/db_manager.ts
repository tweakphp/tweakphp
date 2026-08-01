import path from 'path'
import Database from 'better-sqlite3'
import { settingsDir } from '../settings.ts'

const dbPath = path.join(settingsDir, 'tweakphp.db')

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

export { db }
