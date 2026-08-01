import { db } from '../db_manager'
import { Tab } from '../../../types/tab.type'

export interface TabRecord extends Omit<Tab, 'id'> {
  id: number
  connection_id?: string | null
  active?: boolean
  position?: number
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

interface TabRow {
  id: string | number
  type: string
  name: string
  code: string
  path: string | null
  loader: string | null
  execution: string
  connection_id: string | null
  result: string | null
  queries: string | null
  pane: string | null
  info: string | null
  docker: string | null
  ssh: string | null
  kubectl: string | null
  active: number
  position: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const parseOptionalJson = <T>(value: string | null | undefined): T | undefined => {
  if (!value) return undefined
  return parseJson<T | undefined>(value, undefined)
}

const normalizeTab = (input: Partial<TabRecord>, position = 0): TabRecord => {
  const rawId = input.id ?? Date.now()
  const parsedId = typeof rawId === 'number' ? rawId : Number(rawId)

  return {
    id: Number.isFinite(parsedId) ? parsedId : Date.now(),
    name: input.name ?? '',
    type: input.type ?? 'code',
    code: input.code ?? '',
    path: input.path,
    execution: input.execution ?? 'local',
    loader: input.loader,
    result: Array.isArray(input.result) ? input.result : [],
    queries: Array.isArray(input.queries) ? input.queries : [],
    pane: {
      code: input.pane?.code ?? 50,
      result: input.pane?.result ?? 50,
    },
    info: {
      name: input.info?.name ?? '',
      php_version: input.info?.php_version ?? '',
      version: input.info?.version ?? '',
    },
    ...(input.docker ? { docker: input.docker } : {}),
    ...(input.ssh ? { ssh: input.ssh } : {}),
    ...(input.kubectl ? { kubectl: input.kubectl } : {}),
    connection_id: input.connection_id ?? null,
    active: Boolean(input.active),
    position: input.position ?? position,
    created_at: input.created_at,
    updated_at: input.updated_at,
    deleted_at: input.deleted_at ?? null,
  }
}

const deserializeTab = (row: TabRow): TabRecord => {
  const tab: TabRecord = {
    id: Number(row.id),
    name: row.name,
    type: row.type,
    code: row.code,
    path: row.path ?? undefined,
    execution: row.execution,
    loader: row.loader ?? undefined,
    result: parseJson(row.result, []),
    queries: parseJson(row.queries, []),
    pane: parseJson(row.pane, { code: 50, result: 50 }),
    info: parseJson(row.info, { name: '', php_version: '', version: '' }),
    connection_id: row.connection_id,
    active: Boolean(row.active),
    position: row.position,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }

  const docker = parseOptionalJson<Tab['docker']>(row.docker)
  const ssh = parseOptionalJson<Tab['ssh']>(row.ssh)
  const kubectl = parseOptionalJson<Tab['kubectl']>(row.kubectl)

  if (docker) tab.docker = docker
  if (ssh) tab.ssh = ssh
  if (kubectl) tab.kubectl = kubectl

  return tab
}

const tabColumns = `
  id, type, name, code, path, loader, execution, connection_id,
  result, queries, pane, info, docker, ssh, kubectl,
  active, position, created_at, updated_at, deleted_at
`

export class TabsRepository {
  getAllTabs(includeTrashed: boolean = false): TabRecord[] {
    const whereClause = includeTrashed ? '' : 'WHERE deleted_at IS NULL'
    const stmt = db.prepare(`
      SELECT ${tabColumns}
      FROM tabs
      ${whereClause}
      ORDER BY position ASC
    `)
    const rows = stmt.all() as TabRow[]

    return rows.map(deserializeTab)
  }

  getTrashedTabs(): TabRecord[] {
    const stmt = db.prepare(`
      SELECT ${tabColumns}
      FROM tabs
      WHERE deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `)
    const rows = stmt.all() as TabRow[]

    return rows.map(deserializeTab)
  }

  saveTab(tab: TabRecord): void {
    const normalized = normalizeTab(tab)
    const now = new Date().toISOString()
    const stmt = db.prepare(`
      INSERT INTO tabs (
        id, type, name, code, path, loader, execution, connection_id,
        result, queries, pane, info, docker, ssh, kubectl,
        active, position, created_at, updated_at, deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        name = excluded.name,
        code = excluded.code,
        path = excluded.path,
        loader = excluded.loader,
        execution = excluded.execution,
        connection_id = excluded.connection_id,
        result = excluded.result,
        queries = excluded.queries,
        pane = excluded.pane,
        info = excluded.info,
        docker = excluded.docker,
        ssh = excluded.ssh,
        kubectl = excluded.kubectl,
        active = excluded.active,
        position = excluded.position,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `)

    stmt.run(
      String(normalized.id),
      normalized.type,
      normalized.name,
      normalized.code,
      normalized.path ?? null,
      normalized.loader ?? null,
      normalized.execution || 'local',
      normalized.connection_id || null,
      JSON.stringify(normalized.result),
      JSON.stringify(normalized.queries ?? []),
      JSON.stringify(normalized.pane),
      JSON.stringify(normalized.info),
      normalized.docker ? JSON.stringify(normalized.docker) : null,
      normalized.ssh ? JSON.stringify(normalized.ssh) : null,
      normalized.kubectl ? JSON.stringify(normalized.kubectl) : null,
      normalized.active ? 1 : 0,
      normalized.position ?? 0,
      normalized.created_at || now,
      now,
      normalized.deleted_at || null
    )
  }

  saveAllTabs(tabs: TabRecord[]): void {
    const now = new Date().toISOString()
    const activeIds = tabs.map(tab => String(tab.id))

    const transaction = db.transaction(() => {
      for (let i = 0; i < tabs.length; i++) {
        const tab = normalizeTab(tabs[i], i)
        tab.position = i
        tab.deleted_at = null
        this.saveTab(tab)
      }

      if (activeIds.length > 0) {
        const placeholders = activeIds.map(() => '?').join(',')
        db.prepare(
          `
          UPDATE tabs
          SET deleted_at = ?
          WHERE id NOT IN (${placeholders}) AND deleted_at IS NULL
        `
        ).run(now, ...activeIds)
      } else {
        db.prepare(
          `
          UPDATE tabs
          SET deleted_at = ?
          WHERE deleted_at IS NULL
        `
        ).run(now)
      }
    })
    transaction()
  }

  deleteTab(id: string | number, force: boolean = false): boolean {
    if (force) {
      const stmt = db.prepare(`DELETE FROM tabs WHERE id = ?`)
      const result = stmt.run(String(id))
      return result.changes > 0
    }

    const now = new Date().toISOString()
    const stmt = db.prepare(`UPDATE tabs SET deleted_at = ? WHERE id = ?`)
    const result = stmt.run(now, String(id))
    return result.changes > 0
  }

  restoreTab(id: string | number): boolean {
    const stmt = db.prepare(`UPDATE tabs SET deleted_at = NULL WHERE id = ?`)
    const result = stmt.run(String(id))
    return result.changes > 0
  }
}
