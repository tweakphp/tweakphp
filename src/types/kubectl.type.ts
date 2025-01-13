export interface ConnectionConfig {
  id: number
  name: string
  color: string
  context: string
  namespace: string
  pod: string
  path: string
  php: string | undefined
  phar_client: string | undefined
}
