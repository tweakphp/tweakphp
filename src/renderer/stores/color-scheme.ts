import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { storage, repositoryStorageKeys } from '../storage'

export const useColorSchemeStore = defineStore('color-scheme', () => {
  const scheme = ref('light')
  const storedSchemePromise = storage.get<string>(repositoryStorageKeys.colorScheme).then(value => {
    if (value && ['light', 'dark'].includes(value)) {
      scheme.value = value
    }
  })
  function change(newScheme: string | null = null) {
    let setStorage = newScheme !== null
    if (newScheme === null) {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        newScheme = 'dark'
      } else {
        newScheme = 'light'
      }
    }
    scheme.value = newScheme
    if (setStorage) {
      void storage.set(repositoryStorageKeys.colorScheme, newScheme)
    }
  }

  const isDark = computed(() => scheme.value === 'dark')

  return { scheme, change, isDark, ready: storedSchemePromise }
})
