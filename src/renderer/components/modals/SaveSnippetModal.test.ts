// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SaveSnippetModal from './SaveSnippetModal.vue'
import events from '../../events'

const { add } = vi.hoisted(() => ({ add: vi.fn() }))
vi.mock('../../stores/settings', () => ({ useSettingsStore: () => ({ colors: {} }) }))
vi.mock('../../stores/snippets', () => ({ useSnippetsStore: () => ({ add }) }))

const request = (code: string) => events.dispatchEvent(new CustomEvent('snippet.save.request', { detail: { code } }))

describe('save snippet modal', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
  })
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('blocks dismissal and queues requests while saving', async () => {
    let resolveSave!: () => void
    add.mockImplementation(() => new Promise<void>(resolve => (resolveSave = resolve)))
    const wrapper = mount(SaveSnippetModal, { attachTo: document.body })
    request('first')
    await flushPromises()
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Snippet title"]')!
    input.value = 'My title'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const save = Array.from(document.querySelectorAll('button')).find(
      button => button.textContent?.trim() === 'Save Snippet'
    )!
    save.click()
    await flushPromises()

    expect(input.disabled).toBe(true)
    expect(document.querySelector('button[aria-label="Close"]')).toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
    request('second')
    await flushPromises()
    expect(document.querySelector('pre')?.textContent).toBe('first')
    expect(input.value).toBe('My title')
    expect(add).toHaveBeenCalledWith({ title: 'My title', code: 'first' })

    resolveSave()
    await flushPromises()
    expect(document.querySelector('pre')?.textContent).toBe('second')
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Snippet title"]')?.disabled).toBe(false)
    wrapper.unmount()
  })

  it('keeps a failed request editable and opens the queued request after cancellation', async () => {
    let rejectSave!: (error: Error) => void
    add.mockImplementation(() => new Promise((_resolve, reject) => (rejectSave = reject)))
    const wrapper = mount(SaveSnippetModal, { attachTo: document.body })
    request('first')
    await flushPromises()
    Array.from(document.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'Save Snippet')!
      .click()
    await flushPromises()
    request('second')
    rejectSave(new Error('offline'))
    await flushPromises()
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not save')
    expect(document.querySelector('pre')?.textContent).toBe('first')
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Snippet title"]')?.disabled).toBe(false)
    Array.from(document.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'Cancel')!
      .click()
    await flushPromises()
    expect(document.querySelector('pre')?.textContent).toBe('second')
    wrapper.unmount()
  })

  it.each(['escape', 'outside', 'close button'])('allows %s dismissal when not saving', async method => {
    const wrapper = mount(SaveSnippetModal, { attachTo: document.body })
    request('first')
    await flushPromises()
    if (method === 'escape') {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    } else if (method === 'outside') {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
    } else {
      document.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click()
    }
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })
})
