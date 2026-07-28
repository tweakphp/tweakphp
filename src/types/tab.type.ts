import { ConnectionConfig } from './docker.type'

export interface Result {
  line: number
  code: string
  output: string
  html: string
  htmlReady?: boolean
  queries?: any[]
  query_errors?: any[]
}

export interface QueryItem {
  sql?: string
  query?: string
  raw_sql?: string
  statement?: string
  bindings?: any[]
  time?: number | string
  duration?: number | string
  execution_time?: number | string
  connection?: string
  connection_name?: string
  [key: string]: any
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
  queries?: QueryItem[]
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
