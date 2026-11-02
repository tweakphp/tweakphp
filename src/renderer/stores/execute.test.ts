import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useExecuteStore } from './execute'

describe('execute store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with no executions', () => {
    const store = useExecuteStore()

    expect(store.executing).toBe(false)
    expect(store.isExecuting(5)).toBe(false)
    expect(store.isExecuting(null)).toBe(false)
    expect(store.isExecuting(undefined)).toBe(false)
  })

  it('tracks one execution per tab and several tabs concurrently', () => {
    const store = useExecuteStore()

    store.startExecution(5)
    expect(store.isExecuting(5)).toBe(true)
    expect(store.isExecuting(6)).toBe(false)
    expect(store.executing).toBe(true)

    store.startExecution(6)
    expect(store.isExecuting(5)).toBe(true)
    expect(store.isExecuting(6)).toBe(true)
  })

  it('ends each execution independently and is idempotent', () => {
    const store = useExecuteStore()

    store.startExecution(5)
    store.startExecution(6)

    store.endExecution(5)
    expect(store.isExecuting(5)).toBe(false)
    expect(store.isExecuting(6)).toBe(true)

    // ending twice (or an unknown tab) is a safe no-op
    store.endExecution(5)
    store.endExecution(99)
    expect(store.isExecuting(6)).toBe(true)
    expect(store.executing).toBe(true)

    store.endExecution(6)
    expect(store.executing).toBe(false)
  })
})
