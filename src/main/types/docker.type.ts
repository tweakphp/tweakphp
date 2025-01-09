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
}
