import { ChildProcess, execFile } from 'child_process'
import { Client } from './client.interface'

interface RunningExecution {
  tabId: number
  client: Client
  pid?: number
  child?: ChildProcess
  stopped: boolean
}

const running = new Map<number, RunningExecution>()

const SIGKILL_GRACE_MS = 2_000

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
    void Promise.resolve(execution.client.stop?.(pid)).catch((error: unknown) => {
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

export const stopExecution = async (tabId: number): Promise<boolean> => {
  const execution = running.get(tabId)
  if (!execution || execution.stopped) {
    return false
  }
  execution.stopped = true

  try {
    await execution.client.stop?.(execution.pid)
  } catch (error) {
    console.error('Failed to stop remote execution', error)
  }

  killChild(execution.child)

  const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
    if (running.get(tabId) === execution) {
      execution.client.stop?.()
    }
  }, SIGKILL_GRACE_MS)
  ;(timer as any).unref?.()

  return true
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
