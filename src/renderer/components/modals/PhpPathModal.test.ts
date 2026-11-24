// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PhpPathModal from './PhpPathModal.vue'
import events from '../../events'

const { settingsState, updateMock, replaceMock, pushMock, currentRoute } = vi.hoisted(() => ({
  settingsState: { php: '' },
  updateMock: vi.fn(),
  replaceMock: vi.fn(),
  pushMock: vi.fn(),
  currentRoute: { value: { name: 'settings' as string | undefined } },
}))

vi.mock('../../stores/settings', () => ({
  useSettingsStore: () => ({
    settings: settingsState,
    colors: {},
    update: updateMock,
  }),
}))

vi.mock('../../router', () => ({
  default: {
    currentRoute,
    replace: replaceMock,
    push: pushMock,
  },
}))

const requestPhpPath = (tabId?: number) =>
  events.dispatchEvent(
    new CustomEvent('settings.php-required', { detail: tabId !== undefined ? { tabId } : undefined })
  )

describe('PhpPathModal', () => {
  let ipcListeners: Record<string, Array<(...args: any[]) => void>>
  let sendMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetAllMocks()
    settingsState.php = ''
    currentRoute.value = { name: 'settings' }
    ipcListeners = {}
    sendMock = vi.fn()
    Element.prototype.scrollIntoView = vi.fn()
    ;(window as any).ipcRenderer = {
      on: vi.fn((channel: string, cb: (...args: any[]) => void) => {
        ;(ipcListeners[channel] ??= []).push(cb)
      }),
      once: vi.fn((channel: string, cb: (...args: any[]) => void) => {
        const wrapper = (...args: any[]) => {
          ipcListeners[channel] = (ipcListeners[channel] ?? []).filter(fn => fn !== wrapper)
          cb(...args)
        }
        ;(ipcListeners[channel] ??= []).push(wrapper)
      }),
      removeListener: vi.fn((channel: string, cb: (...args: any[]) => void) => {
        ipcListeners[channel] = (ipcListeners[channel] ?? []).filter(fn => fn !== cb)
      }),
      send: sendMock,
    }
  })

  afterEach(() => {
    document.body.replaceChildren()
  })

  it('opens on settings.php-required, detects PHP paths, saves, and returns to the tab', async () => {
    const wrapper = mount(PhpPathModal, { attachTo: document.body })
    requestPhpPath(42)
    await flushPromises()

    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(document.body.textContent).toContain('PHP path is not set')

    const detectButton = Array.from(document.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Detect PHP')
    )!
    detectButton.click()
    await flushPromises()

    expect(sendMock).toHaveBeenCalledWith('settings.detect-php')
    ;(ipcListeners['settings.detect-php.reply'] ?? [])
      .slice()
      .forEach(cb => cb(['C:\\php\\php.exe', 'C:\\xampp\\php\\php.exe']))
    await flushPromises()

    const input = document.querySelector<HTMLInputElement>('input[aria-label="PHP executable path"]')!
    expect(input.value).toBe('C:\\php\\php.exe')

    const secondOption = Array.from(document.querySelectorAll('button')).find(
      button => button.getAttribute('title') === 'C:\\xampp\\php\\php.exe'
    )!
    expect(secondOption.textContent).toContain('XAMPP')
    secondOption.click()
    await flushPromises()
    expect(input.value).toBe('C:\\xampp\\php\\php.exe')

    const saveButton = Array.from(document.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Save & Continue')
    )!
    saveButton.click()
    await flushPromises()

    expect(settingsState.php).toBe('C:\\xampp\\php\\php.exe')
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledWith({ name: 'code', params: { id: 42 } })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })

  it('shows empty state when no PHP binaries are detected and validates manual input', async () => {
    const wrapper = mount(PhpPathModal, { attachTo: document.body })
    requestPhpPath()
    await flushPromises()

    const detectButton = Array.from(document.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Detect PHP')
    )!
    detectButton.click()
    ;(ipcListeners['settings.detect-php.reply'] ?? []).slice().forEach(cb => cb([]))
    await flushPromises()

    expect(document.body.textContent).toContain('No PHP binaries found in common locations')

    const input = document.querySelector<HTMLInputElement>('input[aria-label="PHP executable path"]')!
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await flushPromises()

    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Please enter a PHP executable path')
    expect(updateMock).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
