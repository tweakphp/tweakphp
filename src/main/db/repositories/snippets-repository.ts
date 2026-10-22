import { randomUUID } from 'crypto'
import { db } from '../db_manager'
import { Snippet } from '../../../types/snippet.type'

export interface SnippetRecord extends Snippet {}

export interface PersistedSnippetRecord extends SnippetRecord {
  id: string
  created_at: string
  updated_at: string
}

interface SnippetRow {
  id: string
  title: string | null
  code: string | null
  created_at: string
  updated_at: string
}

const deserializeSnippet = (row: SnippetRow): PersistedSnippetRecord => ({
  id: row.id,
  title: row.title,
  code: row.code ?? '',
  created_at: row.created_at,
  updated_at: row.updated_at,
})

export class SnippetsRepository {
  getAllSnippets(search?: string): PersistedSnippetRecord[] {
    const term = search?.trim()
    if (term) {
      const stmt = db.prepare(`
        SELECT id, title, code, created_at, updated_at
        FROM snippets
        WHERE title LIKE ? OR code LIKE ?
        ORDER BY updated_at DESC
      `)
      const rows = stmt.all(`%${term}%`, `%${term}%`) as SnippetRow[]
      return rows.map(deserializeSnippet)
    }

    const stmt = db.prepare(`
      SELECT id, title, code, created_at, updated_at
      FROM snippets
      ORDER BY updated_at DESC
    `)
    const rows = stmt.all() as SnippetRow[]

    return rows.map(deserializeSnippet)
  }

  saveSnippet(snippet: SnippetRecord): PersistedSnippetRecord {
    const id = snippet.id ?? randomUUID()
    const now = new Date().toISOString()
    const existing = db.prepare(`SELECT created_at FROM snippets WHERE id = ?`).get(id) as
      { created_at: string } | undefined
    const createdAt = existing?.created_at ?? snippet.created_at ?? now
    const title = snippet.title?.trim() ? snippet.title.trim() : null

    const stmt = db.prepare(`
      INSERT INTO snippets (id, title, code, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        code = excluded.code,
        updated_at = excluded.updated_at
    `)

    stmt.run(id, title, snippet.code ?? '', createdAt, now)

    return {
      id,
      title,
      code: snippet.code ?? '',
      created_at: createdAt,
      updated_at: now,
    }
  }

  deleteSnippet(id: string): boolean {
    const stmt = db.prepare(`DELETE FROM snippets WHERE id = ?`)
    const result = stmt.run(id)
    return result.changes > 0
  }
}
