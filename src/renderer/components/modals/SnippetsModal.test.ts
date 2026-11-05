// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SnippetsModal from './SnippetsModal.vue'
import AutoScrollText from '../AutoScrollText.vue'
import { useSnippetsStore } from '../../stores/snippets'

const { invoke, openForm } = vi.hoisted(() => ({ invoke: vi.fn(), openForm: vi.fn() }))
vi.mock('../../stores/settings', () => ({ useSettingsStore: () => ({ colors: {} }) }))
vi.mock('../../stores/tabs', () => ({ useTabsStore: () => ({ getCurrent: () => ({ id: 1, type: 'code' }) }) }))
vi.mock('../Editor.vue', () => ({ default: defineComponent({ render: () => h('div') }) }))
vi.mock('./SnippetFormModal.vue', () => ({
  default: defineComponent({
    setup: (_props, { expose }) => {
      expose({ openModal: openForm })
      return () => null
    },
  }),
}))
vi.mock('../Modal.vue', () => ({
  default: defineComponent({
    setup: (_props, { expose, slots }) => {
      const open = ref(false)
      expose({ openModal: () => (open.value = true), closeModal: () => (open.value = false) })
      return () => (open.value ? h('div', slots.default?.()) : null)
    },
  }),
}))

const snippets = [
  { id: '1', title: 'First', code: 'first' },
  { id: '2', title: 'Second', code: 'second' },
  { id: '3', title: 'Third', code: 'third' },
]

describe('snippets modal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.stubGlobal('ipcRenderer', undefined)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    )
    Object.defineProperty(window, 'ipcRenderer', { configurable: true, value: { invoke } })
    Element.prototype.scrollIntoView = vi.fn()
    invoke.mockImplementation((_channel: string, payload?: { search?: string }) =>
      Promise.resolve(
        payload?.search ? snippets.filter(s => s.title.toLowerCase().includes(payload.search!.toLowerCase())) : snippets
      )
    )
  })

  const open = async () => {
    const wrapper = mount(SnippetsModal, { global: { directives: { tippy: () => {} } } })
    ;(wrapper.vm as unknown as { openModal: () => void }).openModal()
    await flushPromises()
    await nextTick()
    return wrapper
  }

  it('moves one result per arrow key with Reka navigation', async () => {
    const wrapper = await open()
    const filter = wrapper.get('input[aria-label="Search snippets"]')
    expect(wrapper.get('[role="option"][data-state="checked"]').text()).toContain('First')
    await filter.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(wrapper.get('[role="option"][data-state="checked"]').text()).toContain('Second')
    await filter.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(wrapper.get('[role="option"][data-state="checked"]').text()).toContain('Third')
    wrapper.unmount()
  })

  it('renders snippet list and preview titles with auto-scrolling text', async () => {
    const wrapper = await open()
    const titles = wrapper.findAllComponents(AutoScrollText)
    expect(titles.map(title => title.text())).toEqual(['First', 'Second', 'Third', 'First'])
    wrapper.unmount()
  })

  it('shows delete next to edit and confirms deletion of the selected snippet', async () => {
    const wrapper = await open()
    expect(wrapper.findAll('[role="option"] button')).toHaveLength(0)
    await wrapper.get('input[aria-label="Search snippets"]').trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    const buttons = wrapper.findAll('button')
    const editIndex = buttons.findIndex(button => button.text() === 'Edit')
    expect(buttons[editIndex + 1].text()).toBe('Delete')
    await buttons[editIndex + 1].trigger('click')
    expect(wrapper.text()).toContain('Are you sure you want to delete Second')
    wrapper.unmount()
  })

  it('does not edit stale results during debounce or loading', async () => {
    const wrapper = await open()
    const filter = wrapper.get('input[aria-label="Search snippets"]')
    let resolveSearch!: (results: typeof snippets) => void
    invoke.mockImplementationOnce(() => new Promise(resolve => (resolveSearch = resolve)))
    await filter.setValue('third')
    await filter.trigger('keydown', { key: 'Enter' })
    expect(openForm).not.toHaveBeenCalled()
    await new Promise(resolve => setTimeout(resolve, 220))
    await filter.trigger('keydown', { key: 'Enter' })
    expect(openForm).not.toHaveBeenCalled()
    resolveSearch([snippets[2]])
    await flushPromises()
    expect(useSnippetsStore().snippets).toEqual([snippets[2]])
    await filter.trigger('keydown', { key: 'Enter' })
    expect(openForm).toHaveBeenCalledWith(expect.objectContaining({ id: '3' }))
    wrapper.unmount()
  })
})
