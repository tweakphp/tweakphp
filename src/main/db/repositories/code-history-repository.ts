import { db } from '../db_manager'

export interface CodeHistoryCursor {
  lineNumber: number
  column: number
}

export interface CodeHistoryState {
  code: string
  cursor: CodeHistoryCursor
}

export class CodeHistoryRepository {
  add(tabId: number, code: string, cursor: CodeHistoryCursor): void {
    const transaction = db.transaction(() => {
      const currentState = db.prepare('SELECT current_history_id FROM tab_states WHERE tab_id = ?').get(tabId) as
        { current_history_id: number | null } | undefined

      if (currentState?.current_history_id != null) {
        const lastHistory = db
          .prepare('SELECT code FROM code_histories WHERE id = ?')
          .get(currentState.current_history_id) as { code: string } | undefined

        if (lastHistory && lastHistory.code === code) {
          db.prepare('UPDATE code_histories SET cursor_line = ?, cursor_column = ? WHERE id = ?').run(
            cursor.lineNumber,
            cursor.column,
            currentState.current_history_id
          )
          return
        }

        db.prepare('DELETE FROM code_histories WHERE tab_id = ? AND id > ?').run(tabId, currentState.current_history_id)
      }

      const result = db
        .prepare(
          `
          INSERT INTO code_histories (tab_id, code, cursor_line, cursor_column, created_at)
          VALUES (?, ?, ?, ?, ?)
        `
        )
        .run(tabId, code, cursor.lineNumber, cursor.column, new Date().toISOString())

      db.prepare('INSERT OR REPLACE INTO tab_states (tab_id, current_history_id) VALUES (?, ?)').run(
        tabId,
        result.lastInsertRowid
      )
    })

    transaction()
  }

  undo(tabId: number): CodeHistoryState | null {
    let previousState: CodeHistoryState | null = null

    const transaction = db.transaction(() => {
      const currentState = db.prepare('SELECT current_history_id FROM tab_states WHERE tab_id = ?').get(tabId) as
        { current_history_id: number } | undefined

      if (!currentState) return

      const row = db
        .prepare(
          'SELECT id, code, cursor_line, cursor_column FROM code_histories WHERE tab_id = ? AND id < ? ORDER BY id DESC LIMIT 1'
        )
        .get(tabId, currentState.current_history_id) as
        { id: number; code: string; cursor_line: number; cursor_column: number } | undefined

      if (!row) return

      db.prepare('UPDATE tab_states SET current_history_id = ? WHERE tab_id = ?').run(row.id, tabId)
      previousState = {
        code: row.code,
        cursor: { lineNumber: row.cursor_line, column: row.cursor_column },
      }
    })

    transaction()
    return previousState
  }

  redo(tabId: number): CodeHistoryState | null {
    let nextState: CodeHistoryState | null = null

    const transaction = db.transaction(() => {
      const currentState = db.prepare('SELECT current_history_id FROM tab_states WHERE tab_id = ?').get(tabId) as
        { current_history_id: number } | undefined

      if (!currentState) return

      const row = db
        .prepare(
          'SELECT id, code, cursor_line, cursor_column FROM code_histories WHERE tab_id = ? AND id > ? ORDER BY id ASC LIMIT 1'
        )
        .get(tabId, currentState.current_history_id) as
        { id: number; code: string; cursor_line: number; cursor_column: number } | undefined

      if (!row) return

      db.prepare('UPDATE tab_states SET current_history_id = ? WHERE tab_id = ?').run(row.id, tabId)
      nextState = {
        code: row.code,
        cursor: { lineNumber: row.cursor_line, column: row.cursor_column },
      }
    })

    transaction()
    return nextState
  }
}
