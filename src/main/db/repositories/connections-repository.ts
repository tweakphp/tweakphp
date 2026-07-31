import { randomUUID } from 'crypto'
import { db } from '../db_manager'
import { connectionTypes, ConnectionConfig, ConnectionType } from '../../../types/connection.type'

type ConnectionInput = Record<string, any> & {
  id?: string | number | null
  type?: string
  name?: string | null
}

export type StoredConnection = ConnectionConfig & Record<string, any>

export interface ConnectionRow {
  id: string
  type: string
  name: string
  config: string
  is_active: number
  created_at: string
  updated_at: string
}

const isConnectionType = (type: string | undefined): type is ConnectionType =>
  Boolean(type && connectionTypes.includes(type as ConnectionType))

const normalizeConnection = (input: ConnectionInput): StoredConnection => {
  if (!isConnectionType(input.type)) {
    throw new Error(`Unsupported connection type: ${input.type ?? 'undefined'}`)
  }

  const id = input.id === undefined || input.id === null ? randomUUID() : String(input.id)
  const name = input.name || (input.type === 'docker' ? input.container_name : undefined) || input.type
  const normalized: ConnectionInput = {
    ...input,
    id,
    type: input.type,
    name,
  }

  if (input.type === 'local') {
    normalized.php = input.php ?? ''
    normalized.path = input.path ?? ''
  }

  if (input.type === 'ssh') {
    normalized.color = input.color ?? ''
    normalized.host = input.host ?? ''
    normalized.port = input.port ?? 22
    normalized.username = input.username ?? ''
    normalized.auth_type = input.auth_type ?? 'password'
    normalized.password = input.password ?? ''
    normalized.privateKey = input.privateKey ?? ''
    normalized.passphrase = input.passphrase ?? ''
    normalized.path = input.path ?? ''
    normalized.php = input.php ?? ''
    normalized.client_path = input.phar_client ?? input.client_path
  }

  if (input.type === 'kubectl') {
    normalized.color = input.color ?? ''
    normalized.context = input.context ?? ''
    normalized.namespace = input.namespace ?? ''
    normalized.pod = input.pod ?? ''
    normalized.path = input.path ?? ''
    normalized.php = input.php ?? ''
    normalized.client_path = input.client_path ?? ''
  }

  if (input.type === 'vapor') {
    normalized.client_path = input.client_path ?? null
    normalized.environment = input.environment ?? null
    normalized.environments = input.environments ?? []
  }

  if (input.type === 'docker') {
    normalized.working_directory = input.working_directory ?? input.path ?? ''
    normalized.container_id = input.container_id ?? ''
    normalized.container_name = input.container_name ?? name
    normalized.php_version = input.php_version ?? ''
    normalized.php_path = input.php_path ?? input.php ?? ''
    normalized.client_path = input.client_path ?? ''
    normalized.ssh_id = input.ssh_id ?? null
  }

  return normalized as StoredConnection
}

const deserializeConnection = (row: ConnectionRow): StoredConnection | undefined => {
  try {
    const config = JSON.parse(row.config) as ConnectionInput
    return normalizeConnection({ ...config, id: row.id, type: row.type, name: row.name })
  } catch (error) {
    console.error(`Failed to parse connection config for ID ${row.id}:`, error)
    return undefined
  }
}

export class ConnectionsRepository {
  getAllConnections(): Readonly<StoredConnection>[] {
    const stmt = db.prepare(`
      SELECT id, type, name, config, is_active, created_at, updated_at
      FROM connections
      ORDER BY updated_at DESC
    `)
    const rows = stmt.all() as ConnectionRow[]

    return rows.flatMap(row => {
      const connection = deserializeConnection(row)
      return connection ? [connection] : []
    })
  }

  getConnection(id: string | number): Readonly<StoredConnection> | undefined {
    const stmt = db.prepare(`
      SELECT id, type, name, config, is_active, created_at, updated_at
      FROM connections
      WHERE id = ?
    `)
    const row = stmt.get(String(id)) as ConnectionRow | undefined
    return row ? deserializeConnection(row) : undefined
  }

  saveConnection(connection: ConnectionInput, isActive: boolean = false): Readonly<StoredConnection> {
    const normalized = normalizeConnection(connection)
    const now = new Date().toISOString()
    const { id, type, name, ...config } = normalized

    const stmt = db.prepare(`
      INSERT INTO connections (id, type, name, config, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        name = excluded.name,
        config = excluded.config,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `)

    stmt.run(id, type, name, JSON.stringify(config), isActive ? 1 : 0, now, now)
    return normalized
  }

  deleteConnection(id: string | number): boolean {
    const stmt = db.prepare(`DELETE FROM connections WHERE id = ?`)
    const result = stmt.run(String(id))
    return result.changes > 0
  }

  setActiveConnection(id: string | number): void {
    const transaction = db.transaction(() => {
      db.prepare(`UPDATE connections SET is_active = 0`).run()
      db.prepare(`UPDATE connections SET is_active = 1 WHERE id = ?`).run(String(id))
    })
    transaction()
  }

  getActiveConnection(): Readonly<StoredConnection> | undefined {
    const stmt = db.prepare(`
      SELECT id, type, name, config, is_active, created_at, updated_at
      FROM connections
      WHERE is_active = 1
      LIMIT 1
    `)
    const row = stmt.get() as ConnectionRow | undefined
    return row ? deserializeConnection(row) : undefined
  }
}
