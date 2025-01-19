import { ConnectionConfig } from './docker.type'

export interface Tab {
  id: number
  name: string
  type: string
  code: string
  path: string | undefined
  execution: string
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
  docker?: ConnectionConfig
  ssh?: {
    id: number
  }
  kubectl?: {
    id: number
  }
}
