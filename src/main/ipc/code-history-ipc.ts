import { IpcMainEvent, ipcMain } from 'electron'
import { z } from 'zod'
import { CodeHistoryCursor, CodeHistoryRepository } from '../db/repositories/code-history-repository'

interface CodeAddPayload {
  tabId: number
  code: string
  cursor: CodeHistoryCursor
}

const tabIdSchema = z.number().int().positive()
const codeAddSchema = z.object({
  tabId: tabIdSchema,
  code: z.string(),
  cursor: z.object({
    lineNumber: z.number().int().positive(),
    column: z.number().int().positive(),
  }),
})

const codeHistoryRepository = new CodeHistoryRepository()

export function registerCodeHistoryIpc(): void {
  ipcMain.on('code-history:add', (event: IpcMainEvent, payload: CodeAddPayload) => {
    try {
      const { tabId, code, cursor } = codeAddSchema.parse(payload)
      codeHistoryRepository.add(tabId, code, cursor)
      event.reply('code-history:add:reply', { data: { success: true }, error: null })
    } catch (error) {
      console.error('Failed to add code history:', error)
      event.reply('code-history:add:reply', { data: null, error: 'Failed to add code history' })
    }
  })

  ipcMain.on('code-history:undo', (event: IpcMainEvent, tabId: number) => {
    try {
      tabIdSchema.parse(tabId)
      const previousState = codeHistoryRepository.undo(tabId)
      event.reply('code-history:undo:reply', {
        data: previousState,
        error: previousState ? null : 'No previous state to undo.',
      })
    } catch (error) {
      console.error('Failed to undo:', error)
      event.reply('code-history:undo:reply', { data: null, error: 'Failed to undo' })
    }
  })

  ipcMain.on('code-history:redo', (event: IpcMainEvent, tabId: number) => {
    try {
      tabIdSchema.parse(tabId)
      const nextState = codeHistoryRepository.redo(tabId)
      event.reply('code-history:redo:reply', {
        data: nextState,
        error: nextState ? null : 'No next state to redo.',
      })
    } catch (error) {
      console.error('Failed to redo:', error)
      event.reply('code-history:redo:reply', { data: null, error: 'Failed to redo' })
    }
  })
}
