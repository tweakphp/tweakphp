// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SnippetFormModal from './SnippetFormModal.vue'

const { add } = vi.hoisted(() => ({ add: vi.fn() }))
vi.mock('../../stores/settings', () => ({ useSettingsStore: () => ({ colors: {} }) }))
vi.mock('../../stores/snippets', () => ({ useSnippetsStore: () => ({ add }) }))
vi.mock('../Editor.vue', () => ({
  default: defineComponent({
    props: ['value', 'readonly'],
    emits: ['update:value'],
    setup:
      (props, { emit }) =>
      () =>
        h('textarea', {
          value: props.value,
          readonly: props.readonly,
          onInput: (event: Event) => emit('update:value', (event.target as HTMLTextAreaElement).value),
        }),
  }),
}))
vi.mock('../Modal.vue', () => ({
  default: defineComponent({
    setup: (_props, { expose, slots }) => {
      const open = ref(false)
      expose({ openModal: () => (open.value = true), closeModal: () => (open.value = false) })
      return () => (open.value ? h('div', [slots.default?.(), slots.actions?.()]) : null)
    },
  }),
}))
vi.mock('./ConfirmModal.vue', () => ({ default: defineComponent({ render: () => null }) }))

describe('snippet form saving', () => {
  beforeEach(() => vi.resetAllMocks())

  it('locks fields while saving and restores them on failure', async () => {
    let rejectSave!: (error: Error) => void
    add.mockImplementation(() => new Promise((_resolve, reject) => (rejectSave = reject)))
    const wrapper = mount(SnippetFormModal)
    ;(wrapper.vm as unknown as { openModal: () => void }).openModal()
    await nextTick()
    await wrapper.get('input').setValue('Title')
    await wrapper.get('textarea').setValue('echo 1;')
    await wrapper
      .findAll('button')
      .find(button => button.text() === 'Save Snippet')!
      .trigger('click')

    expect((wrapper.get('input').element as HTMLInputElement).disabled).toBe(true)
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).readOnly).toBe(true)
    expect(wrapper.findAll('button').every(button => (button.element as HTMLButtonElement).disabled)).toBe(true)
    rejectSave(new Error('offline'))
    await flushPromises()
    expect((wrapper.get('input').element as HTMLInputElement).disabled).toBe(false)
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).readOnly).toBe(false)
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('echo 1;')
    expect(wrapper.get('[role="alert"]').text()).toContain('Could not save')
    wrapper.unmount()
  })
})
