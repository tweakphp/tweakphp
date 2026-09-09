import { ConnectionConfig as SSHConnectionConfig } from './ssh.type'

export interface ConnectionConfig {
  type: 'docker'
  working_directory: string
  container_id: string
  container_name: string
  // Resolved lazily by DockerClient.setup(): the DB may store '' / null
  php_version?: string | null
  php_path?: string | null
  client_path?: string | null
  php?: string
  path?: string
  /** Id of the SSH host used to reach docker; 0 = local docker daemon */
  ssh_id?: number | string
  user?: string
  ssh?: SSHConnectionConfig
}
