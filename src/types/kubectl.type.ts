export interface ConnectionConfig {
  type: 'kubectl'
  id: number
  name: string
  color: string
  context: string
  namespace: string
  pod: string
  path: string
  php: string | undefined
  client_path: string | undefined
}
