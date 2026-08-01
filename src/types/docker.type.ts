import { ConnectionConfig as SSHConnectionConfig } from './ssh.type'

export interface ConnectionConfig {
  type: 'docker'
  working_directory: string
  container_id: string
  container_name: string
  php_version: string
  php_path: string
  client_path: string
  php?: string
  path?: string
  ssh_id: number
  ssh?: SSHConnectionConfig
}
