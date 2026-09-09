export interface ConnectionConfig {
  /** Tab id for per-tab vapor configs; may be a string id in legacy rows. */
  id: number | string
  type: 'vapor'
  client_path: string | null
  environment: string | null
  environments: string[] | []
}
