// @vitest-environment jsdom
import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { Tab } from '../../types/tab.type'
import { useSettingsStore } from '../stores/settings'
import { createPinia, setActivePinia } from 'pinia'
import { joinResultOutputs, visibleResults } from '../utils/output'
import { useCodeExecution } from './useCodeExecution'

vi.mock('../themes', () => ({ themeNames: [], themeColors: {} }))

const setup = () => {
  setActivePinia(createPinia())
  const tab = ref<Tab>({
    id: 1,
    type: 'code',
    name: 'Test',
    code: '',
    path: '',
    execution: 'local',
    result: [],
    pane: { code: 50, result: 50 },
    info: { name: '', php_version: '', version: '' },
  })
  const rawOutput = computed(() => joinResultOutputs(visibleResults(tab.value.result, 'explicit')))
  const updateValue = vi.fn()
  const execution = useCodeExecution({
    tab,
    rawOutput,
    resultEditor: ref({ updateValue }),
    settingsStore: useSettingsStore(),
    executeStore: { setExecuting: vi.fn() },
    tabsStore: { getConnectionConfig: () => undefined, updateTab: vi.fn() },
    loadersStore: { get: () => undefined },
  })
  const stream = (event: Record<string, unknown>) =>
    execution.executeStreamListener(new CustomEvent('stream', { detail: { tabId: 1, event } }))

  return { tab, rawOutput, updateValue, stream }
}

describe('streaming output', () => {
  it('separates the print return value from its explicit output and HTML', () => {
    const { tab, rawOutput, updateValue, stream } = setup()
    stream({ type: 'statement.started', index: 0, line: 8, code: 'print $user->email;' })
    stream({ type: 'output', index: 0, data: 'feil.noel@' })
    stream({ type: 'output', index: 0, data: 'example.com' })
    stream({ type: 'output', index: 0, data: '1', html: '<pre>1</pre>', implicit: true })
    stream({ type: 'statement.completed', index: 0, implicit: false })

    expect(rawOutput.value).toBe('feil.noel@example.com')
    expect(updateValue).toHaveBeenLastCalledWith('feil.noel@example.com')
    expect(visibleResults(tab.value.result, 'explicit')[0]).toMatchObject({
      output: 'feil.noel@example.com',
      html: '',
      htmlReady: true,
    })
    expect(visibleResults(tab.value.result, 'all')[0]).toMatchObject({
      output: 'feil.noel@example.com1',
      html: '<pre>1</pre>',
      parts: [
        { output: 'feil.noel@example.com', html: '', implicit: false },
        { output: '1', html: '<pre>1</pre>', implicit: true },
      ],
    })
    expect(visibleResults(tab.value.result, 'explicit')[0].parts).toEqual([
      { output: 'feil.noel@example.com', html: '', implicit: false },
    ])
  })

  it('preserves an explicitly printed 1 instead of stripping output by its value', () => {
    const { rawOutput, stream } = setup()
    stream({ type: 'statement.started', index: 0, line: 1, code: 'print 1;' })
    stream({ type: 'output', index: 0, data: '1' })
    stream({ type: 'output', index: 0, data: '1', implicit: true })
    stream({ type: 'statement.completed', index: 0, implicit: false })

    expect(rawOutput.value).toBe('1')
  })

  it('preserves explicit dumps and hides only their implicit return HTML', () => {
    const { tab, rawOutput, stream } = setup()
    stream({ type: 'statement.started', index: 0, line: 1, code: 'print_r([1]);' })
    stream({ type: 'output', index: 0, data: 'Array (1)', html: '<pre>Array (1)</pre>' })
    stream({ type: 'output', index: 0, data: 'true', html: '<pre>true</pre>', implicit: true })
    stream({ type: 'statement.completed', index: 0, implicit: false })

    expect(rawOutput.value).toBe('Array (1)')
    expect(visibleResults(tab.value.result, 'explicit')[0].html).toBe('<pre>Array (1)</pre>')
  })

  it('hides implicit-only output throughout streaming, retaining it for Full stack', () => {
    const { tab, rawOutput, stream } = setup()
    stream({ type: 'statement.started', index: 0, line: 1, code: '$user = User::first();' })
    stream({ type: 'output', index: 0, data: 'User {...}', html: '<pre>User {...}</pre>', implicit: true })
    expect(rawOutput.value).toBe('')
    stream({ type: 'statement.completed', index: 0, implicit: true })

    expect(rawOutput.value).toBe('')
    expect(visibleResults(tab.value.result, 'all')[0].output).toBe('User {...}')
  })
})
