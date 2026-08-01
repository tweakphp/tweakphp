import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import { History } from '../../types/history.type'
import { storage, repositoryStorageKeys } from '../storage'

export const useHistoryStore = defineStore('history', () => {
  const history: Ref<History[]> = ref([])
  const ready = storage.get<any[]>(repositoryStorageKeys.history).then(storedHistory => {
    history.value = (storedHistory ?? []).map(item => ({ path: item.path ?? item }))
  })

  const persist = () => void storage.set(repositoryStorageKeys.history, history.value)

  const addHistory = (h: History): void => {
    // history must be unique
    let index = history.value.findIndex((item: History) => item.path === h.path)
    if (index === -1) {
      history.value.push(h)
      persist()
    }
  }

  const removeHistory = (h: History): void => {
    let index = history.value.findIndex((item: History) => item === h)
    if (index === -1) {
      return
    }
    history.value.splice(index, 1)
    persist()
  }

  return { history, addHistory, removeHistory, ready }
})
