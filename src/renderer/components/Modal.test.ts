// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modal from './Modal.vue'
import SelectInput from './SelectInput.vue'
import PromptModal from './modals/PromptModal.vue'
import ConfirmModal from './modals/ConfirmModal.vue'
import ArchiveConfirmModal from './modals/ArchiveConfirmModal.vue'
import SaveSnippetModal from './modals/SaveSnippetModal.vue'
import events from '../events'

vi.mock('../stores/settings', () => ({ useSettingsStore: () => ({ colors: {} }) }))
vi.mock('../stores/tabs', () => ({
  useTabsStore: () => ({
    findTab: (id: number) => ({ id, name: 'Demo project' }),
    removeTab: vi.fn(),
  }),
}))
vi.mock('../stores/archive', () => ({ useArchiveStore: () => ({ forceDelete: vi.fn() }) }))
vi.mock('../stores/snippets', () => ({ useSnippetsStore: () => ({ add: vi.fn() }) }))

const openAndFlush = async (wrapper: ReturnType<typeof mount>) => {
  ;(wrapper.vm as unknown as { openModal: () => void }).openModal()
  await flushPromises()
  await nextTick()
}

describe('modal focus', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    document.body.replaceChildren()
  })

  it('focuses the first content element instead of the close button by default', async () => {
    const Host = defineComponent({
      setup() {
        const modal = ref<InstanceType<typeof Modal> | null>(null)
        return { modal }
      },
      render() {
        return h(
          Modal,
          { ref: 'modal', title: 'Test modal' },
          {
            default: () => h('input', { 'aria-label': 'First input' }),
            actions: () => h('button', { type: 'button' }, 'Submit'),
          }
        )
      },
    })

    const wrapper = mount(Host, { attachTo: document.body })
    ;(wrapper.vm as unknown as { modal: { openModal: () => void } }).modal.openModal()
    await flushPromises()
    await nextTick()

    expect(document.activeElement).toBe(document.querySelector('input[aria-label="First input"]'))
    expect(document.activeElement).not.toBe(document.querySelector('button[aria-label="Close"]'))
    wrapper.unmount()
  })

  it('focuses the data-autofocus element and selects input text', async () => {
    const Host = defineComponent({
      setup() {
        const modal = ref<InstanceType<typeof Modal> | null>(null)
        return { modal }
      },
      render() {
        return h(
          Modal,
          { ref: 'modal', title: 'Custom target' },
          {
            default: () => [
              h('button', { type: 'button' }, 'Secondary action'),
              h('input', { 'aria-label': 'Target input', 'data-autofocus': true, 'value': 'hello' }),
            ],
          }
        )
      },
    })

    const wrapper = mount(Host, { attachTo: document.body })
    ;(wrapper.vm as unknown as { modal: { openModal: () => void } }).modal.openModal()
    await flushPromises()
    await nextTick()

    const input = document.querySelector<HTMLInputElement>('input[aria-label="Target input"]')!
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(5)
    wrapper.unmount()
  })

  it('forwards data-autofocus into SelectInput select element', async () => {
    const Host = defineComponent({
      setup() {
        const modal = ref<InstanceType<typeof Modal> | null>(null)
        return { modal }
      },
      render() {
        return h(
          Modal,
          { ref: 'modal', title: 'Select modal' },
          {
            default: () => [
              h('input', { 'aria-label': 'Other input' }),
              h(
                SelectInput,
                { 'id': 'target-select', 'data-autofocus': true, 'modelValue': 'a' },
                { default: () => [h('option', { value: 'a' }, 'A')] }
              ),
            ],
          }
        )
      },
    })

    const wrapper = mount(Host, { attachTo: document.body })
    ;(wrapper.vm as unknown as { modal: { openModal: () => void } }).modal.openModal()
    await flushPromises()
    await nextTick()

    expect(document.activeElement).toBe(document.querySelector('select#target-select'))
    wrapper.unmount()
  })

  it('respects parent open-auto-focus preventDefault', async () => {
    const Host = defineComponent({
      setup() {
        const modal = ref<InstanceType<typeof Modal> | null>(null)
        return { modal }
      },
      render() {
        return h(
          Modal,
          {
            ref: 'modal',
            title: 'Prevented',
            onOpenAutoFocus: (event: Event) => event.preventDefault(),
          },
          {
            default: () => h('input', { 'aria-label': 'Skipped', 'data-autofocus': true }),
          }
        )
      },
    })

    const wrapper = mount(Host, { attachTo: document.body })
    ;(wrapper.vm as unknown as { modal: { openModal: () => void } }).modal.openModal()
    await flushPromises()
    await nextTick()

    expect(document.activeElement).not.toBe(document.querySelector('input[aria-label="Skipped"]'))
    wrapper.unmount()
  })

  it('focuses and selects input text in PromptModal', async () => {
    const wrapper = mount(PromptModal, {
      attachTo: document.body,
      props: {
        title: 'Rename folder',
        label: 'Folder Name',
        id: 'folderName',
        initialValue: 'Existing',
      },
    })

    await openAndFlush(wrapper)

    const input = document.querySelector<HTMLInputElement>('input#folderName')!
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe('Existing'.length)
    wrapper.unmount()
  })

  it('focuses Cancel by default in ConfirmModal', async () => {
    const wrapper = mount(ConfirmModal, {
      attachTo: document.body,
      props: {
        title: 'Delete item',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      },
    })

    await openAndFlush(wrapper)

    const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Cancel')
    expect(document.activeElement).toBe(cancelBtn)
    wrapper.unmount()
  })

  it('focuses Archive button in ArchiveConfirmModal', async () => {
    const wrapper = mount(ArchiveConfirmModal, { attachTo: document.body })
    events.dispatchEvent(new CustomEvent('tab.archive.request', { detail: 1 }))
    await flushPromises()
    await nextTick()

    const archiveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Archive')
    expect(document.activeElement).toBe(archiveBtn)
    wrapper.unmount()
  })

  it('focuses title input in SaveSnippetModal', async () => {
    const wrapper = mount(SaveSnippetModal, { attachTo: document.body })
    events.dispatchEvent(new CustomEvent('snippet.save.request', { detail: { code: 'echo 1;' } }))
    await flushPromises()
    await nextTick()

    expect(document.activeElement).toBe(document.querySelector('input[aria-label="Snippet title"]'))
    wrapper.unmount()
  })
})
