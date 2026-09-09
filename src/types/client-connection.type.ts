import type { ConnectionConfig as LocalConnectionConfig } from './local.type'
import type { ConnectionConfig as SSHConnectionConfig } from './ssh.type'
import type { ConnectionConfig as DockerConnectionConfig } from './docker.type'
import type { ConnectionConfig as KubectlConnectionConfig } from './kubectl.type'
import type { ConnectionConfig as VaporConnectionConfig } from './vapor.type'

/**
 * Union of the per-type connection configs used by the clients (and sent by the
 * renderer through the `client:*` IPC channels).
 */
export type ClientConnectionConfig =
  LocalConnectionConfig | SSHConnectionConfig | DockerConnectionConfig | KubectlConnectionConfig | VaporConnectionConfig
