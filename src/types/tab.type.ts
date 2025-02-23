import { ConnectionConfig } from './docker.type'

export interface Result {
  line: number
  code: string
  output: string
  html: string
}

export interface Tab {
  id: number
  name: string
  type: string
  code: string
  path: string | undefined
  execution: string
  loader?: string
  result: Result[]
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
