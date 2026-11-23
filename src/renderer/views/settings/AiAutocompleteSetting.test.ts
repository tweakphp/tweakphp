// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AiAutocompleteSetting from './AiAutocompleteSetting.vue'

const mockSettingsStore = reactive({
  settings: {
    aiStatus: false,
    aiProvider: null as string | null,
    aiModelId: null as string | null,
    aiApiKey: null as string | null,
    aiPromptTemplateGenerateCodeFromComment: '',
    aiPromptTemplateCompleteComment: '',
    aiPromptTemplateCompleteCode: '',
  },
  colors: {
    backgroundDark: '#111',
    background: '#222',
    foreground: '#fff',
    border: '#333',
  },
  update: vi.fn(),
})

vi.mock('../../stores/settings', () => ({
  useSettingsStore: () => mockSettingsStore,
}))

vi.mock('../../composables/useOpenrouter', () => ({
  useOpenRouter: () => ({
    models: [],
    loading: false,
    error: null,
    fetchModels: vi.fn(),
  }),
}))

describe('AiAutocompleteSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingsStore.settings.aiStatus = false
    mockSettingsStore.settings.aiProvider = null
    mockSettingsStore.settings.aiModelId = null
    mockSettingsStore.settings.aiApiKey = null
    mockSettingsStore.settings.aiPromptTemplateGenerateCodeFromComment = ''
    mockSettingsStore.settings.aiPromptTemplateCompleteComment = ''
    mockSettingsStore.settings.aiPromptTemplateCompleteCode = ''
  })

  it('hides provider, API key, and Customization prompt sections when AI completion is inactive', () => {
    const wrapper = mount(AiAutocompleteSetting)

    expect(wrapper.text()).toContain('AI Completion')
    expect(wrapper.find('#ai-status').exists()).toBe(true)
    expect(wrapper.find('#ai-provider').exists()).toBe(false)
    expect(wrapper.find('#api-key').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Customization prompt')
    expect(wrapper.find('#ai-prompt-template-generate-code-from-comment').exists()).toBe(false)
    expect(wrapper.find('#ai-prompt-template-complete-comment').exists()).toBe(false)
    expect(wrapper.find('#ai-prompt-template-complete-code').exists()).toBe(false)

    wrapper.unmount()
  })

  it('shows provider, API key, and Customization prompt sections when AI completion is active', async () => {
    const wrapper = mount(AiAutocompleteSetting)

    expect(wrapper.find('#ai-provider').exists()).toBe(false)
    expect(wrapper.find('#api-key').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Customization prompt')

    mockSettingsStore.settings.aiStatus = true
    await nextTick()

    expect(wrapper.find('#ai-provider').exists()).toBe(true)
    expect(wrapper.find('#api-key').exists()).toBe(true)
    expect(wrapper.text()).toContain('Customization prompt')
    expect(wrapper.find('#ai-prompt-template-generate-code-from-comment').exists()).toBe(true)
    expect(wrapper.find('#ai-prompt-template-complete-comment').exists()).toBe(true)
    expect(wrapper.find('#ai-prompt-template-complete-code').exists()).toBe(true)

    wrapper.unmount()
  })
})
