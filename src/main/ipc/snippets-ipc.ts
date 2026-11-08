import { ipcMain } from 'electron'
import { z } from 'zod'
import { SnippetsRepository, SnippetRecord } from '../db/repositories/snippets-repository'

const snippetSchema = z.object({
  id: z.string().optional(),
  title: z.string().nullish(),
  code: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

const snippetsRepo = new SnippetsRepository()

export function registerSnippetsIpc(): void {
  ipcMain.handle('storage:snippets:list', async (_event, payload?: { search?: string }) => {
    const search = typeof payload?.search === 'string' ? payload.search : undefined
    return snippetsRepo.getAllSnippets(search)
  })

  ipcMain.handle('storage:snippets:save', async (_event, snippet: SnippetRecord) => {
    const parsed = snippetSchema.parse(snippet)
    return snippetsRepo.saveSnippet(parsed)
  })

  ipcMain.handle('storage:snippets:delete', async (_event, id: string) => {
    const parsed = z.string().min(1).parse(id)
    return { success: snippetsRepo.deleteSnippet(parsed) }
  })
}
