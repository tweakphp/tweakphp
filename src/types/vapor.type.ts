export interface ConnectionConfig {
  id: number
  type: 'vapor'
  client_path: string | null
  environment: string | null
  environments: string[] | []
  tab_id?: number | null
}
