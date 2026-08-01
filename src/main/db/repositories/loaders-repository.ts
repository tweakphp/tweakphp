import { randomUUID } from 'crypto'
import { db } from '../db_manager'
import { Loader } from '../../../types/loader.type'

/**
 * The renderer currently owns only name and code. The optional id is the
 * persistence identity that can be exposed by the store in a later migration.
 */
export interface LoaderRecord extends Loader {
  id?: string
  created_at?: string
  updated_at?: string
}

export interface PersistedLoaderRecord extends LoaderRecord {
  id: string
}

interface LoaderRow {
  id: string
  name: string | null
  code: string | null
  created_at: string
  updated_at: string
}

const normalizeLoader = (loader: LoaderRecord): LoaderRecord => ({
  ...(loader.id ? { id: loader.id } : {}),
  name: loader.name ?? '',
  code: loader.code ?? '',
  created_at: loader.created_at,
  updated_at: loader.updated_at,
})

const deserializeLoader = (row: LoaderRow): PersistedLoaderRecord => ({
  id: row.id,
  name: row.name ?? '',
  code: row.code ?? '',
  created_at: row.created_at,
  updated_at: row.updated_at,
})

export class LoadersRepository {
  getAllLoaders(): PersistedLoaderRecord[] {
    const stmt = db.prepare(`
      SELECT id, name, code, created_at, updated_at
      FROM loaders
      ORDER BY created_at ASC
    `)
    const rows = stmt.all() as LoaderRow[]

    return rows.map(deserializeLoader)
  }

  saveLoader(loader: LoaderRecord): PersistedLoaderRecord {
    const normalized = normalizeLoader(loader)
    const existing = normalized.id
      ? (db.prepare(`SELECT id, created_at FROM loaders WHERE id = ?`).get(normalized.id) as
          { id: string; created_at: string } | undefined)
      : (db
          .prepare(`SELECT id, created_at FROM loaders WHERE name = ? ORDER BY created_at ASC LIMIT 1`)
          .get(normalized.name) as { id: string; created_at: string } | undefined)
    const id = existing?.id ?? normalized.id ?? randomUUID()
    const now = new Date().toISOString()
    const createdAt = existing?.created_at ?? normalized.created_at ?? now

    const stmt = db.prepare(`
      INSERT INTO loaders (id, name, code, enabled, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        code = excluded.code,
        updated_at = excluded.updated_at
    `)

    stmt.run(id, normalized.name, normalized.code, createdAt, now)

    return {
      id,
      name: normalized.name,
      code: normalized.code,
      created_at: createdAt,
      updated_at: now,
    }
  }

  deleteLoader(identifier: string): boolean {
    const stmt = db.prepare(`DELETE FROM loaders WHERE id = ? OR name = ?`)
    const result = stmt.run(identifier, identifier)
    return result.changes > 0
  }
}
