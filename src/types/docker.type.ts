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

export interface DockerConnectionConfig {
  working_directory: string
  container_id: string
  container_name: string
  ssh_id: number
}
