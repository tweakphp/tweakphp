export interface ConnectionConfig {
  type: 'ssh'
  id: number
  name: string
  color: string
  host: string
  port: number
  username: string
  auth_type: string
  password: string | undefined
  privateKey: string | undefined
  passphrase: string | undefined
  path: string
  php: string | undefined
  client_path: string | undefined
  tab_id?: number | null
}
