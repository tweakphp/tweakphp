import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from './settings'

const { themeNames, themeColors } = vi.hoisted(() => {
  const themeNames = ['dracula', 'nord']
  const themeColors: Record<string, Record<string, string>> = {
    dracula: { foreground: '#f8f8f2', background: '#282a36', border: '#44475a' },
    nord: { foreground: '#d8dee9', background: '#2e3440', border: '#4c566a' },
  }
  return { themeNames, themeColors }
})

vi.mock('../themes', () => ({
  themeNames,
  themeColors,
}))

vi.stubGlobal('window', { ipcRenderer: { send: vi.fn() } })

describe('settings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps a valid persisted theme', () => {
    const store = useSettingsStore()

    store.setSettings({ theme: 'nord' })

    expect(store.settings.theme).toBe('nord')
    expect(store.colors.foreground).toBe(themeColors.nord.foreground)
  })

  it('falls back to the default theme when the persisted theme no longer exists', () => {
    const store = useSettingsStore()

    store.setSettings({ theme: 'ultra-dark' })

    expect(store.settings.theme).toBe('dracula')
    expect(store.colors.foreground).toBe(themeColors.dracula.foreground)
  })

  it('falls back to the default theme when the persisted settings have no theme', () => {
    const store = useSettingsStore()

    store.setSettings({})

    expect(store.settings.theme).toBe('dracula')
    expect(store.colors.background).toBe(themeColors.dracula.background)
  })

  it('fills missing fields with defaults', () => {
    const store = useSettingsStore()

    store.setSettings({ theme: 'nord', streaming: false })

    expect(store.settings.streaming).toBe(false)
    expect(store.settings.editorFontSize).toBe(15)
    expect(store.colors.foreground).toBe(themeColors.nord.foreground)
  })

  it('exposes defined colors even before any settings are loaded', () => {
    const store = useSettingsStore()

    expect(store.colors.foreground).toBe(themeColors.dracula.foreground)
  })
})
