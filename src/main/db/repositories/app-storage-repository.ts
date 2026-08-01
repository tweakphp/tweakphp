import { db } from '../db_manager'

export class AppStorageRepository {
  get<T = unknown>(key: string): T | undefined {
    const row = db.prepare(`SELECT value FROM settings_kv WHERE key = ?`).get(key) as { value: string } | undefined

    if (!row) return undefined

    try {
      return JSON.parse(row.value) as T
    } catch {
      return row.value as T
    }
  }

  set(key: string, value: unknown): void {
    db.prepare(
      `
      INSERT INTO settings_kv (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `
    ).run(key, JSON.stringify(value))
  }

  remove(key: string): boolean {
    const result = db.prepare(`DELETE FROM settings_kv WHERE key = ?`).run(key)
    return result.changes > 0
  }
}
