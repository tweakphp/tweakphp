import { ConnectionConfig } from '../../types/kubectl.type'
import { createConnectionStore } from './create-connection-store'

export const useKubectlStore = createConnectionStore<ConnectionConfig>(
  'kubectl',
  'kubectl-connections',
  (connection: any) => ({
    type: 'kubectl',
    id: connection.id ?? 0,
    name: connection.name ?? '',
    color: connection.color ?? '',
    context: connection.context ?? '',
    namespace: connection.namespace ?? '',
    pod: connection.pod ?? '',
    path: connection.path ?? '',
    php: connection.php ?? '',
    client_path: connection.client_path ?? '',
  })
)
