/**
 * Shared constants for the main process (ports, timeouts, default paths).
 */

export { LSP_WEBSOCKET_DEFAULT_PORT } from '../shared/constants'

export const DEV_SERVER_DEFAULT_PORT = 4999

export const DEFAULT_MCP_PORT = 3000

export const SETUP_TIMEOUT_MS = 30_000

// Hard cap so a hung PHP process cannot leave the execution pending forever
export const LOCAL_EXECUTION_TIMEOUT_MS = 120_000

// Quick environment discovery commands (WSL distro listing, docker ps, ...)
export const DISCOVERY_TIMEOUT_MS = 2_000

export const WSL_PHP_LOOKUP_TIMEOUT_MS = 1_500

export const SERVER_CLOSE_TIMEOUT_MS = 5_000

export const DEFAULT_MCP_EXECUTION_TIMEOUT_MS = 30_000

export const MCP_LOADER_EXECUTION_TIMEOUT_MS = 60_000

export const KUBECTL_EXECUTION_TIMEOUT_MS = 60_000

export const MCP_STATUS_BROADCAST_INTERVAL_MS = 2_000

export const WINDOW_INIT_DELAY_MS = 1_500

export const DEFAULT_DOCKER_WORKING_DIR = '/var/www/html'

export const DEFAULT_DOCKER_CLIENT_PATH = '/tmp/client.phar'
