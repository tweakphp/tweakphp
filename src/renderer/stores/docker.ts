import { ConnectionConfig } from '../../types/docker.type'
import { createConnectionStore } from './create-connection-store'

export const useDockerStore = createConnectionStore<ConnectionConfig>('docker', 'docker-connections', (connection: any) => ({
  type: 'docker',
  id: connection.id ?? 0,
  name: connection.name ?? connection.container_name ?? '',
  container_id: connection.container_id ?? '',
  container_name: connection.container_name ?? '',
  working_directory: connection.working_directory ?? '/var/www/html',
  php_version: connection.php_version ?? '',
  php_path: connection.php_path ?? '',
  client_path: connection.client_path ?? '',
  ssh_id: connection.ssh_id ?? 0,
  user: connection.user ?? '',
  tab_id: connection.tab_id ?? null,
}))
