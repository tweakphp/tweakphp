import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getExecution,
  isExecutionStopped,
  registerExecution,
  setExecutionChild,
  setExecutionPid,
  stopExecution,
  unregisterExecution,
} from './executions'

const createClient = (stop?: (...args: any[]) => Promise<void>) => ({
  connect: vi.fn(),
  setup: vi.fn(),
  action: vi.fn(),
  execute: vi.fn(),
  info: vi.fn(),
  disconnect: vi.fn(),
  getConnection: vi.fn(),
  ...(stop ? { stop: vi.fn(stop) } : {}),
})

const createChild = () => ({
  pid: 4321,
  exitCode: null,
  signalCode: null,
  killed: false,
  kill: vi.fn(),
})

describe('execution registry', () => {
  beforeEach(() => {
    unregisterExecution(1)
    unregisterExecution(2)
  })

  it('registers and retrieves a running execution', () => {
    const client = createClient()
    registerExecution(1, client as any)

    expect(getExecution(1)?.client).toBe(client)
    expect(getExecution(1)?.stopped).toBe(false)
    expect(isExecutionStopped(1)).toBe(false)
  })

  it('stores the pid and the child process', () => {
    const client = createClient()
    registerExecution(1, client as any)
    setExecutionPid(1, 999)
    setExecutionChild(1, createChild() as any)

    expect(getExecution(1)?.pid).toBe(999)
    expect(getExecution(1)?.child?.pid).toBe(4321)
  })

  it('unregisters an execution', () => {
    registerExecution(1, createClient() as any)
    unregisterExecution(1)

    expect(getExecution(1)).toBeUndefined()
  })

  it('keeps the registration when an older execution unregisters', () => {
    const clientA = createClient()
    const clientB = createClient()
    registerExecution(1, clientA as any)
    registerExecution(1, clientB as any)

    unregisterExecution(1, clientA as any)
    expect(getExecution(1)?.client).toBe(clientB)

    unregisterExecution(1, clientB as any)
    expect(getExecution(1)).toBeUndefined()
  })

  it('stops the client with the captured pid and kills the local child', async () => {
    const stop = vi.fn().mockResolvedValue(undefined)
    const client = createClient()
    ;(client as any).stop = stop
    const child = createChild()
    registerExecution(1, client as any)
    setExecutionPid(1, 4321)
    setExecutionChild(1, child as any)

    await expect(stopExecution(1)).resolves.toBe(true)

    expect(stop).toHaveBeenCalledWith(4321)
    expect(child.kill).toHaveBeenCalledWith('SIGTERM')
    expect(isExecutionStopped(1)).toBe(true)
  })

  it('is idempotent: a second stop is a no-op', async () => {
    const stop = vi.fn().mockResolvedValue(undefined)
    const client = createClient()
    ;(client as any).stop = stop
    registerExecution(1, client as any)

    await expect(stopExecution(1)).resolves.toBe(true)
    await expect(stopExecution(1)).resolves.toBe(false)

    expect(stop).toHaveBeenCalledOnce()
  })

  it('kills the local child even when the client has no stop support', async () => {
    const client = createClient()
    const child = createChild()
    registerExecution(2, client as any)
    setExecutionChild(2, child as any)

    await expect(stopExecution(2)).resolves.toBe(true)

    expect(child.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('does not kill an already exited child', async () => {
    const client = createClient()
    const child = { ...createChild(), exitCode: 0 }
    registerExecution(2, client as any)
    setExecutionChild(2, child as any)

    await stopExecution(2)

    expect(child.kill).not.toHaveBeenCalled()
  })

  it('survives a failing client stop and still kills the child', async () => {
    const stop = vi.fn().mockRejectedValue(new Error('kill failed'))
    const client = createClient()
    ;(client as any).stop = stop
    const child = createChild()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    registerExecution(2, client as any)
    setExecutionChild(2, child as any)

    await expect(stopExecution(2)).resolves.toBe(true)

    expect(child.kill).toHaveBeenCalledWith('SIGTERM')
    consoleError.mockRestore()
  })

  it('kills a late-spawned child when the execution is already stopped', async () => {
    const client = createClient()
    registerExecution(2, client as any)
    await stopExecution(2)

    const child = createChild()
    setExecutionChild(2, child as any)

    expect(child.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('re-triggers the remote kill when the pid arrives after a stop', async () => {
    const stop = vi.fn().mockResolvedValue(undefined)
    const client = createClient()
    ;(client as any).stop = stop
    registerExecution(2, client as any)
    await stopExecution(2)

    setExecutionPid(2, 4321)

    expect(stop).toHaveBeenLastCalledWith(4321)
  })

  it('returns false for an unknown tab', async () => {
    await expect(stopExecution(999)).resolves.toBe(false)
  })

  it('forces the interrupt fallback when the stream is still running after the grace period', async () => {
    vi.useFakeTimers()
    try {
      const stop = vi.fn().mockResolvedValue(undefined)
      const client = createClient()
      ;(client as any).stop = stop
      registerExecution(2, client as any)

      await stopExecution(2)
      expect(stop).toHaveBeenCalledOnce()

      await vi.advanceTimersByTimeAsync(2_000)
      expect(stop).toHaveBeenCalledTimes(2)
      expect(stop).toHaveBeenLastCalledWith()
    } finally {
      unregisterExecution(2)
      vi.useRealTimers()
    }
  })

  it('does not force the interrupt fallback once the execution finished', async () => {
    vi.useFakeTimers()
    try {
      const stop = vi.fn().mockResolvedValue(undefined)
      const client = createClient()
      ;(client as any).stop = stop
      registerExecution(2, client as any)

      await stopExecution(2)
      unregisterExecution(2)

      await vi.advanceTimersByTimeAsync(2_000)
      expect(stop).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })
})
