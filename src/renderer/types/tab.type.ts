export interface DockerSSH {
  ssh_id: any
  php: string
  docker_path: string
  container_name: string
  container_id: string
  php_version: string
  phar_client: string
  working_directory: string
}

export interface Tab {
  id: number
  name: string
  type: string
  code: string
  path: string | undefined
  execution: 'local' | 'ssh' | 'docker-ssh' | 'docker'
  remote_phar_client: string | undefined
  remote_path: string | undefined
  result: string | undefined
  pane: {
    code: number
    result: number
  }
  info: {
    name: string
    php_version: string
    version: string
  }
  docker: {
    enable: boolean
    php: string
    container_name: string
    container_id: string
    php_version: string
  }
  ssh?: {
    id: number
  }
  docker_ssh?: DockerSSH
}
