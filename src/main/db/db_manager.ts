import path from 'path'
import Database from 'better-sqlite3'
import { settingsDir } from '../settings.ts'

const dbPath = path.join(settingsDir, 'tweakphp.db')

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
// Enforce declared foreign keys: connections.tab_id ON DELETE CASCADE (project
// owns its connections) and tabs.connection_id ON DELETE SET NULL
db.pragma('foreign_keys = ON')

export { db }
