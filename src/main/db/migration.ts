import { db } from './db_manager'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    run_on DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`
).run()

function getAppliedMigrations(): string[] {
  const rows = db.prepare(`SELECT name FROM migrations ORDER BY id`).all()
  return rows.map((row: any) => row.name)
}

function applyMigration(filePath: string, name: string) {
  const sql = fs.readFileSync(filePath, 'utf-8')
  const transaction = db.transaction(() => {
    db.exec(sql)
    db.prepare(`INSERT INTO migrations (name) VALUES (?)`).run(name)
  })
  transaction()
}

export function runMigrations() {
  const migrationsDir = path.join(app.getAppPath(), 'migrations')
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
  const appliedMigrations = getAppliedMigrations()

  try {
    for (const file of migrationFiles) {
      if (!appliedMigrations.includes(file)) {
        applyMigration(path.join(migrationsDir, file), file)
        console.log(`Applied migration: ${file}`)
      }
    }
  } catch (error) {
    throw new Error(`Migration failed: ${error}`)
  }

  console.log('All migrations applied.')
}
