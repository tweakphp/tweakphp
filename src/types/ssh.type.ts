export interface ConnectionConfig {
  type: 'ssh'
  /**
   * Numeric (Date.now()) for connections created by the renderer; the DB
   * stores strings, so legacy/foreign rows may surface string ids — lookups
   * must be representation-agnostic (see createConnectionStore helpers).
   */
  id: number | string
  name: string
  color: string
  host: string
  port: number
  username: string
  /**
   * Real runtime values (SSHConnectView / utils/ssh.ts): 'password' | 'key'.
   * NOTE: it is NOT 'private_key' — legacy dead types in connection.type.ts
   * documented it that way; see Task R4.1 of plan/SECURITY_RENDERER_PLAN.md.
   */
  auth_type: 'password' | 'key'
  password: string | undefined
  privateKey: string | undefined
  passphrase: string | undefined
  path: string
  php: string | undefined
  client_path: string | undefined
}
