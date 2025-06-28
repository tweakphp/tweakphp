import Database from 'better-sqlite3'
import path from 'path'

const dbPath: string =
  process.env.NODE_ENV === 'development' ? './tweakphp.db' : path.join(process.resourcesPath, './tweakphp.db')

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

export { db }
