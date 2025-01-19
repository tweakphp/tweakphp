import { ConnectionConfig as SSHConnectionConfig } from './ssh.type'

export interface ConnectionConfig {
  type: 'docker'
  working_directory: string
  container_id: string
  container_name: string
  php_version: string
  php_path: string
  client_path: string
  ssh_id: number
  ssh?: SSHConnectionConfig
}

export interface DockerContainerResponse {
  id: string
  name: string
  image: string
}

export interface PHPInfoResponse {
  php_path: string
  php_version: string
}

export interface PharPathResponse {
  container_name: string
  phar_path: string
  docker_path?: string
}
