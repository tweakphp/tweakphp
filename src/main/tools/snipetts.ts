import { ipcMain, IpcMainEvent } from 'electron'
import { db } from '../db/db_manager'
import { Snippet } from '../../types/snippet.type.ts'
import { z } from 'zod'

export async function initSnippet() {
  ipcMain.on(
    'snippet-saved',
    (event: IpcMainEvent, snippet: Partial<Omit<Snippet, 'id' | 'created_at' | 'updated_at'>>) => {
      try {
        const createdAt = new Date().toISOString()
        const saveSnippetSql = db.prepare(`
            INSERT INTO snippets (name,code,tab_id,tab_name,tags,created_at,updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)

        const snippetSchema = z.object({
          code: z.string().min(1, 'Code cannot be empty'),
          name: z.string().min(1, 'Name cannot be empty'),
          tab_id: z.number().nullable().optional(),
          tab_name: z.string().nullable().optional(),
          tags: z.array(z.string()).optional(),
        })

        const parsedSnippet = snippetSchema.safeParse(snippet)

        if (!parsedSnippet.success) {
          console.error('Validation failed:', parsedSnippet.error)
          event.reply('snippet-saved.reply', {
            error: parsedSnippet.error.errors.map(e => e.message).join(', '),
          })
          return
        }

        const result = saveSnippetSql.run(
          snippet.name || '',
          snippet.code || '',
          snippet.tab_id || null,
          snippet.tab_name || null,
          JSON.stringify(snippet.tags || []),
          createdAt,
          createdAt
        )

        const newSnippet: Snippet = {
          id: result.lastInsertRowid as number,
          name: snippet.name || '',
          code: snippet.code || '',
          tab_id: snippet.tab_id,
          tab_name: snippet.tab_name,
          tags: snippet.tags,
          created_at: createdAt,
          updated_at: createdAt,
        }
        event.reply('snippet-saved.reply', {
          data: newSnippet,
          error: null,
        })
      } catch (error) {
        console.log('Failed to save snippet:', error)
        event.reply('snippet-saved.reply', {
          data: null,
          error: 'Failed to save snippet',
        })
      }
    }
  )

  ipcMain.on('update-snippet', (event: IpcMainEvent, snippet: Partial<Omit<Snippet, 'created_at'>>) => {
    try {
      const updatedAt = new Date().toISOString()
      const updateSnippetSql = db.prepare(`
          UPDATE snippets
          SET name = ?, code = ?, tab_id = ?, tab_name = ?, tags = ?, updated_at = ?
          WHERE id = ?
        `)

      const snippetSchema = z.object({
        id: z.number().int().positive('ID must be a positive integer'),
        name: z.string().min(1, 'Name cannot be empty'),
        code: z.string().min(1, 'Code cannot be empty'),
        tab_id: z.number().optional(),
        tab_name: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })

      const parsedSnippet = snippetSchema.safeParse(snippet)

      if (!parsedSnippet.success) {
        console.error('Validation failed:', parsedSnippet.error)
        event.reply('snippet-saved.reply', {
          error: parsedSnippet.error.errors.map(e => e.message).join(', '),
        })
        return
      }

      updateSnippetSql.run(
        snippet.name,
        snippet.code,
        snippet.tab_id,
        snippet.tab_name,
        JSON.stringify(snippet.tags || []),
        updatedAt,
        snippet.id
      )

      event.reply('update-snippet.reply', {
        data: snippet,
        error: null,
      })
    } catch (error) {
      console.error('Failed to update snippet:', error)
      event.reply('update-snippet.reply', {
        data: null,
        error: 'Failed to update snippet',
      })
    }
  })

  ipcMain.on('load-snippets', (event: IpcMainEvent, filter: string | number | null = null) => {
    try {
      console.log('Loading snippets with filter:', filter)

      let query = 'SELECT * FROM snippets WHERE 1=1' // Trick to always have a WHERE clause
      const params: any = {}

      if (filter) {
        query += ' AND name LIKE @name COLLATE NOCASE'
        params.name = `%${filter}%`
        query += ' OR tab_name LIKE @tab_name COLLATE NOCASE'
        params.tab_name = `%${filter}%`
        query += ' OR tags LIKE @tags COLLATE NOCASE'
        params.tags = `%${filter}%`
        query += ' OR code LIKE @code COLLATE NOCASE'
        params.code = `%${filter}%`
      }

      const listSnippetSql = db.prepare(query).all(params)
      event.reply('load-snippets.reply', {
        data: listSnippetSql.map((row: any) => ({
          id: row.id,
          name: row.name,
          code: row.code,
          tab_id: row.tab_id || null,
          tab_name: row.tab_name || null,
          tags: row.tags ? JSON.parse(row.tags) : [],
          created_at: row.created_at,
        })) as Snippet[],
        error: null,
      })
    } catch (error) {
      console.error('Failed to load snippets:', error)
      event.reply('load-snippets.reply', {
        data: [],
        error: 'Failed to load snippets',
      })
    }
  })

  ipcMain.on('delete-snippet', (event: IpcMainEvent, id: number) => {
    try {
      const snippetSchema = z.object({
        id: z.number().int().positive('ID must be a positive integer'),
      })

      const parsedSnippet = snippetSchema.safeParse({ id })

      if (!parsedSnippet.success) {
        console.error('Validation failed:', parsedSnippet.error)
        event.reply('snippet-saved.reply', {
          error: parsedSnippet.error.errors.map(e => e.message).join(', '),
        })
        return
      }

      const deleteSnippetSql = db.prepare(`DELETE FROM snippets WHERE id = ?`)
      deleteSnippetSql.run(id)
      event.reply('delete-snippet.reply', {
        data: id,
        error: null,
      })
    } catch (error) {
      console.error('Failed to delete snippet:', error)
      event.reply('delete-snippet.reply', {
        data: null,
        error: 'Failed to delete snippet',
      })
    }
  })

  ipcMain.on('delete-all-snippets', (event: IpcMainEvent) => {
    try {
      const deleteAllSnippetSql = db.prepare(`DELETE FROM snippets`)
      deleteAllSnippetSql.run()
      event.reply('delete-all-snippets.reply', {
        success: true,
        error: null,
      })
    } catch (error) {
      console.error('Failed to delete all snippets:', error)
      event.reply('delete-all-snippets.reply', {
        success: false,
        error: 'Failed to delete all snippets',
      })
    }
  })
}
