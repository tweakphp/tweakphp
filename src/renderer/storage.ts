import { toRaw } from 'vue'

export const toPlain = <T>(value: T): T => {
  const raw = toRaw(value as object) as T

  if (Array.isArray(raw)) {
    return raw.map(item => toPlain(item)) as T
  }

  if (raw && typeof raw === 'object') {
    return Object.fromEntries(Object.entries(raw).map(([key, item]) => [key, toPlain(item)])) as T
  }

  return raw
}

export const storage = {
  get<T>(key: string): Promise<T | undefined> {
    return window.ipcRenderer.invoke('storage:app:get', key) as Promise<T | undefined>
  },

  set(key: string, value: unknown): Promise<unknown> {
    return window.ipcRenderer.invoke('storage:app:set', key, toPlain(value))
  },

  remove(key: string): Promise<unknown> {
    return window.ipcRenderer.invoke('storage:app:remove', key)
  },
}

export const repositoryStorageKeys = {
  history: 'renderer.history',
  colorScheme: 'renderer.color-scheme',
  update: 'renderer.update',
  currentTab: 'renderer.current-tab',
}
