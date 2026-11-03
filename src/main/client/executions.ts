import { ChildProcess, execFile } from 'child_process'
import { Client } from './client.interface'

interface RunningExecution {
  tabId: number
  client: Client
  pid?: number
  child?: ChildProcess
  stopped: boolean
}

export interface StopCallbacks {
  /** called when the process survived even the SIGKILL: it is unkillable (D-state) */
  onNotTerminable?: () => void
}

const running = new Map<number, RunningExecution>()

const SIGKILL_GRACE_MS = 2_000
// Gate 3: wait for the remote kill to take effect before escalating
const STOP_ESCALATION_MS = 5_000

export const registerExecution = (tabId: number, client: Client): void => {
  running.set(tabId, { tabId, client, stopped: false })
}

export const unregisterExecution = (tabId: number, client?: Client): void => {
  if (!client || running.get(tabId)?.client === client) {
    running.delete(tabId)
  }
}

export const getExecution = (tabId: number): RunningExecution | undefined => {
  return running.get(tabId)
}

export const isExecutionStopped = (tabId: number): boolean => {
  return running.get(tabId)?.stopped ?? false
}

export const setExecutionPid = (tabId: number, pid: number): void => {
  const execution = running.get(tabId)
  if (!execution) {
    return
  }
  execution.pid = pid
  if (execution.stopped) {
    // stop was requested before the pid was reported: kill with it now
    void Promise.resolve(execution.client.stop?.(pid, 'TERM')).catch((error: unknown) => {
      console.error('Failed to stop remote execution', error)
    })
  }
}

export const setExecutionChild = (tabId: number, child: ChildProcess): void => {
  const execution = running.get(tabId)
  if (!execution) {
    return
  }
  execution.child = child
  if (execution.stopped) {
    killChild(child)
  }
}

// Gate 1: a transport handle that already exited means the remote process is
// gone: never send a kill, the pid may already have been reused.
const remoteHandleAlive = (execution: RunningExecution): boolean => {
  if (execution.child) {
    return execution.child.exitCode === null && execution.child.signalCode === null
  }
  // transports without a local handle (ssh streams): let the client report
  return execution.client.isRunning?.() ?? true
}

export const stopExecution = async (tabId: number, callbacks: StopCallbacks = {}): Promise<boolean> => {
  const execution = running.get(tabId)
  if (!execution || execution.stopped) {
    return false
  }
  execution.stopped = true

  if (remoteHandleAlive(execution)) {
    try {
      await execution.client.stop?.(execution.pid, 'TERM')
    } catch (error) {
      console.error('Failed to stop remote execution', error)
    }
  }

  killChild(execution.child)
  scheduleEscalation(tabId, execution, callbacks)

  return true
}

const scheduleEscalation = (tabId: number, execution: RunningExecution, callbacks: StopCallbacks): void => {
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
    if (running.get(tabId) !== execution) return
    if (!remoteHandleAlive(execution)) return

    // still alive after SIGTERM: escalate to the identity-checked SIGKILL
    void Promise.resolve(execution.client.stop?.(execution.pid, 'KILL')).catch((error: unknown) => {
      console.error('Failed to force-stop remote execution', error)
    })
    killChild(execution.child)

    const finalTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
      if (running.get(tabId) !== execution) return
      if (!remoteHandleAlive(execution)) return

      // survived SIGKILL: unkillable (D-state) — report and drop the transport
      // so the UI unblocks instead of hanging until the execution timeout
      void Promise.resolve(execution.client.stop?.()).catch(() => {})
      callbacks.onNotTerminable?.()
    }, STOP_ESCALATION_MS)
    ;(finalTimer as any).unref?.()
  }, STOP_ESCALATION_MS)
  ;(timer as any).unref?.()
}

const killChild = (child?: ChildProcess): void => {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return
  }
  try {
    if (process.platform === 'win32') {
      if (child.pid) {
        execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], () => {})
      }
      return
    }
    child.kill('SIGTERM')
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL')
      }
    }, SIGKILL_GRACE_MS)
    ;(timer as any).unref?.()
  } catch {}
}
