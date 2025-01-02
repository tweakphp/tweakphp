export interface ConnectionConfig {
  host: string
  port: number
  username: string
  auth_type: string
  password: string | undefined
  privateKey: string | undefined
}

export interface ConnectionReply {
  connected: boolean
  config: ConnectionConfig
}
