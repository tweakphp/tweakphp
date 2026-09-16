import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyExecuteReply, type ExecuteApplyContext } from './useCodeExecution'
import type { Tab } from '../../types/tab.type'
import events from '../events'

const createTab = (): Tab =>
  ({
    id: 1,
    name: 'test',
    code: '',
    output: '',
    result: [],
    queries: [],
    settings: {},
  }) as unknown as Tab

const createContext = (): ExecuteApplyContext => ({
  getConnectionConfig: vi.fn().mockReturnValue({ type: 'local' }),
  updateTab: vi.fn(),
})

describe('applyExecuteReply', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unwraps the non-streaming envelope { output: [...], queries: [...] }', () => {
    const tab = createTab()
    const ctx = createContext()

    applyExecuteReply(
      tab,
      {
        tabId: 1,
        output: {
          output: [{ line: 3, code: 'use App\\Models\\User;', queries: [], output: 'hello' }],
          queries: [],
        },
      },
      ctx
    )

    expect(tab.result).toHaveLength(1)
    expect(tab.result[0]).toMatchObject({ line: 3, output: 'hello' })
  })

  it('parses a plain array of results', () => {
    const tab = createTab()
    const ctx = createContext()

    applyExecuteReply(tab, { tabId: 1, output: [{ line: 1, code: 'echo 1;', queries: [], output: '1' }] }, ctx)

    expect(tab.result).toHaveLength(1)
    expect(tab.result[0].output).toBe('1')
  })

  it('falls back to raw string output for non-result payloads', () => {
    const tab = createTab()
    const ctx = createContext()

    applyExecuteReply(tab, { tabId: 1, output: 'plain output' }, ctx)

    expect(tab.result).toHaveLength(1)
    expect(tab.result[0].output).toBe('plain output')
  })

  it('parses TWEAKPHP_ERROR payloads as errors', () => {
    const tab = createTab()
    const ctx = createContext()

    applyExecuteReply(tab, { tabId: 1, error: 'TWEAKPHP_ERROR: something broke' }, ctx)

    expect(tab.result).toHaveLength(1)
    expect(tab.result[0].output).toContain('something broke')
  })

  it('notifies results applied for the tab', () => {
    const tab = createTab()
    const ctx = createContext()
    const listener = vi.fn()
    events.addEventListener('client:execute:applied', listener)

    applyExecuteReply(tab, { tabId: 1, output: 'plain output' }, ctx)

    expect(listener).toHaveBeenCalledTimes(1)
    events.removeEventListener('client:execute:applied', listener)
  })
})
