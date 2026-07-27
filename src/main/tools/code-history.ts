import { ipcMain, IpcMainEvent } from 'electron'
import { db } from '../db/db_manager'
import { z } from 'zod'

interface CodeAddPayload {
  tabId: number
  code: string
  cursor: {
    lineNumber: number
    column: number
  }
}

export async function initCodeHistory() {
  /**
   * Adds a new state to the history, including cursor position.
   */
  ipcMain.on('code-add', (event: IpcMainEvent, { tabId, code, cursor }: CodeAddPayload) => {
    try {
      const addSchema = z.object({
        tabId: z.number().int().positive(),
        code: z.string(),
        cursor: z.object({
          lineNumber: z.number().int().positive(),
          column: z.number().int().positive(),
        }),
      })
      addSchema.parse({ tabId, code, cursor })

      const runAdd = db.transaction(() => {
        const currentState = db.prepare('SELECT current_history_id FROM tab_states WHERE tab_id = ?').get(tabId) as
          { current_history_id: number | null } | undefined

        if (currentState?.current_history_id) {
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

          db.prepare('DELETE FROM code_histories WHERE tab_id = ? AND id > ?').run(
            tabId,
            currentState.current_history_id
          )
        }

        const createdAt = new Date().toISOString()
        const insertSql = `
            INSERT INTO code_histories (tab_id, code, cursor_line, cursor_column, created_at) 
            VALUES (?, ?, ?, ?, ?)
        `
        const result = db.prepare(insertSql).run(tabId, code, cursor.lineNumber, cursor.column, createdAt)
        const newHistoryId = result.lastInsertRowid

        db.prepare('INSERT OR REPLACE INTO tab_states (tab_id, current_history_id) VALUES (?, ?)').run(
          tabId,
          newHistoryId
        )
      })

      runAdd()
      event.reply('code-add.reply', { data: { success: true }, error: null })
    } catch (error) {
      console.error('Failed to add code history:', error)
      event.reply('code-add.reply', { data: null, error: 'Failed to add code history' })
    }
  })

  /**
   * Executes UNDO for a given tab.
   * Returns the code and cursor position of the previous state.
   */
  ipcMain.on('code-undo', (event: IpcMainEvent, tabId: number) => {
    try {
      z.number().int().positive().parse(tabId)

      let previousStateData: { code: string; cursor: { lineNumber: number; column: number } } | null = null

      const runUndo = db.transaction(() => {
        const currentState = db.prepare('SELECT current_history_id FROM tab_states WHERE tab_id = ?').get(tabId) as
          { current_history_id: number } | undefined

        if (!currentState) {
          return
        }

        const selectSql =
          'SELECT id, code, cursor_line, cursor_column FROM code_histories WHERE tab_id = ? AND id < ? ORDER BY id DESC LIMIT 1'
        const previousState = db.prepare(selectSql).get(tabId, currentState.current_history_id) as
          { id: number; code: string; cursor_line: number; cursor_column: number } | undefined

        if (previousState) {
          db.prepare('UPDATE tab_states SET current_history_id = ? WHERE tab_id = ?').run(previousState.id, tabId)
          previousStateData = {
            code: previousState.code,
            cursor: {
              lineNumber: previousState.cursor_line,
              column: previousState.cursor_column,
            },
          }
        }
      })

      runUndo()

      if (previousStateData !== null) {
        event.reply('code-undo.reply', { data: previousStateData, error: null })
      } else {
        event.reply('code-undo.reply', { data: null, error: 'No previous state to undo.' })
      }
    } catch (error) {
      console.error('Failed to undo:', error)
      event.reply('code-undo.reply', { data: null, error: 'Failed to undo' })
    }
  })

  /**
   * Executes REDO for a given tab.
   * Returns the code and cursor position of the next state.
   */
  ipcMain.on('code-redo', (event: IpcMainEvent, tabId: number) => {
    try {
      z.number().int().positive().parse(tabId)

      let nextStateData: { code: string; cursor: { lineNumber: number; column: number } } | null = null

      const runRedo = db.transaction(() => {
        const currentState = db.prepare('SELECT current_history_id FROM tab_states WHERE tab_id = ?').get(tabId) as
          { current_history_id: number } | undefined

        if (!currentState) {
          return
        }

        const selectSql =
          'SELECT id, code, cursor_line, cursor_column FROM code_histories WHERE tab_id = ? AND id > ? ORDER BY id ASC LIMIT 1'
        const nextState = db.prepare(selectSql).get(tabId, currentState.current_history_id) as
          { id: number; code: string; cursor_line: number; cursor_column: number } | undefined

        if (nextState) {
          db.prepare('UPDATE tab_states SET current_history_id = ? WHERE tab_id = ?').run(nextState.id, tabId)
          nextStateData = {
            code: nextState.code,
            cursor: {
              lineNumber: nextState.cursor_line,
              column: nextState.cursor_column,
            },
          }
        }
      })

      runRedo()

      if (nextStateData !== null) {
        event.reply('code-redo.reply', { data: nextStateData, error: null })
      } else {
        event.reply('code-redo.reply', { data: null, error: 'No next state to redo.' })
      }
    } catch (error) {
      console.error('Failed to redo:', error)
      event.reply('code-redo.reply', { data: null, error: 'Failed to redo' })
    }
  })
}
