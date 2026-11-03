import { quotePosixShellArg } from './shell'

export type StopSignal = 'TERM' | 'KILL'

/**
 * Basename of the phar path actually used by the connection: the identity check
 * matches the remote pid's command line against it, so a reused pid (or any
 * unrelated process) can never be killed by mistake.
 */
export const clientStopPattern = (clientPath?: string): string => {
  const trimmed = clientPath?.trim()
  const base = trimmed ? trimmed.split(/[\\/]/).pop() : undefined
  return base && base !== '' ? base : 'client'
}

/**
 * Single POSIX script that verifies the pid belongs to the TweakPHP client and
 * only then kills it. The check runs inside the remote namespace through the
 * same transport used to run the phar (ssh / docker exec / kubectl exec / wsl),
 * so a stale or reused pid exits 1 without sending any signal.
 *
 * - Linux & containers: match against /proc/<pid>/cmdline
 * - macOS (no /proc): match against `ps -p <pid> -o command=`
 */
export const buildPosixStopScript = (pid: number, clientPattern: string, signal: StopSignal = 'TERM'): string => {
  const pattern = quotePosixShellArg(clientPattern)
  const check =
    `if [ -r /proc/${pid}/cmdline ]; then ` +
    `grep -q -- ${pattern} /proc/${pid}/cmdline; ` +
    'else ' +
    `ps -p ${pid} -o command= 2>/dev/null | grep -q -- ${pattern}; ` +
    'fi'
  return `${check} && kill -${signal} ${pid}`
}

/**
 * Windows equivalent of the identity check: verify the process command line via
 * CIM, then force-kill the whole tree (php runs below a cmd.exe shell handle,
 * so the tree kill is required to reach it).
 */
export const buildWindowsStopScript = (pid: number, clientPattern: string): string => {
  const regex = clientPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return (
    `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}"; ` +
    `if ($p -and $p.CommandLine -match '${regex}') { taskkill /PID ${pid} /T /F } else { exit 1 }`
  )
}
