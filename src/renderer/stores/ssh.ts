import { ConnectionConfig } from '../../types/ssh.type'
import { createConnectionStore } from './create-connection-store'

export const useSSHStore = createConnectionStore<ConnectionConfig>('ssh', 'ssh-connections', (connection: any) => ({
  type: 'ssh',
  id: connection.id ?? 0,
  name: connection.name ?? '',
  color: connection.color ?? '',
  host: connection.host ?? '',
  port: connection.port ?? 22,
  username: connection.username ?? '',
  auth_type: connection.auth_type ?? 'password',
  password: connection.password ?? '',
  privateKey: connection.privateKey ?? '',
  passphrase: connection.passphrase ?? '',
  path: connection.path ?? '',
  php: connection.php ?? '',
  client_path: connection.phar_client ? connection.phar_client : connection.client_path,
}))
