export interface ConnectionConfig {
  id: number
  host: string
  port: number
  username: string
  auth_type: string
  password: string | undefined
  privateKey: string | undefined
  path: string
}

export interface ConnectionReply {
  connected: boolean
  config: ConnectionConfig
}
