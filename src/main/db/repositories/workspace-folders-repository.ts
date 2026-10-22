import { db } from '../db_manager'
import { WorkspaceFolder } from '../../../types/workspace-folder.type'

interface FolderRow {
  id: number | string
  name: string
  position: number
  created_at: string
  updated_at: string
}

const folderColumns = `
  id, name, position, created_at, updated_at
`

const deserializeFolder = (row: FolderRow): WorkspaceFolder => {
  return {
    id: Number(row.id),
    name: row.name,
    position: row.position,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export class WorkspaceFoldersRepository {
  getAllFolders(): WorkspaceFolder[] {
    const rows = db
      .prepare(
        `
      SELECT ${folderColumns}
      FROM workspace_folders
      ORDER BY position ASC, id ASC
    `
      )
      .all() as FolderRow[]

    return rows.map(deserializeFolder)
  }

  createFolder(name: string): WorkspaceFolder {
    const now = new Date().toISOString()
    const maxRow = db.prepare(`SELECT COALESCE(MAX(position), -1) AS maxPosition FROM workspace_folders`).get() as {
      maxPosition: number
    }
    const position = maxRow.maxPosition + 1

    const result = db
      .prepare(
        `
        INSERT INTO workspace_folders (name, position, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `
      )
      .run(name, position, now, now)

    return {
      id: Number(result.lastInsertRowid),
      name,
      position,
      created_at: now,
      updated_at: now,
    }
  }

  updateFolder(folder: WorkspaceFolder): boolean {
    const now = new Date().toISOString()
    const result = db
      .prepare(
        `
        UPDATE workspace_folders
        SET name = ?, position = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .run(folder.name, folder.position ?? 0, now, folder.id)

    return result.changes > 0
  }

  deleteFolder(id: number): boolean {
    const transaction = db.transaction((): boolean => {
      db.prepare(`UPDATE tabs SET folder_id = NULL WHERE folder_id = ?`).run(id)
      const result = db.prepare(`DELETE FROM workspace_folders WHERE id = ?`).run(id)
      return result.changes > 0
    })

    return transaction()
  }

  reorderFolders(ids: number[]): void {
    const transaction = db.transaction(() => {
      const now = new Date().toISOString()
      const stmt = db.prepare(`UPDATE workspace_folders SET position = ?, updated_at = ? WHERE id = ?`)
      ids.forEach((id, index) => {
        stmt.run(index, now, id)
      })
    })

    transaction()
  }
}
