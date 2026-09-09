export interface ConnectionConfig {
  type: 'kubectl'
  /** Numeric for renderer-created connections; may be a string id in legacy rows. */
  id: number | string
  name: string
  color: string
  context: string
  namespace: string
  pod: string
  path: string
  php: string | undefined
  client_path: string | undefined
}
