export interface ConnectionConfig {
  id: number
  name: string
  color: string
  host: string
  port: number
  username: string
  auth_type: string
  password: string | undefined
  privateKey: string | undefined
  path: string
  php: string | undefined
  phar_client: string | undefined
}

export interface ConnectionReply {
  connected: boolean
  config: ConnectionConfig
}
