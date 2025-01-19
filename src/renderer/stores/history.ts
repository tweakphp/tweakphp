import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import { History } from '../../types/history.type'

export const useHistoryStore = defineStore('history', () => {
  let defaultHistory: History[] = []
  let storedHistory = localStorage.getItem('history')
  if (storedHistory) {
    JSON.parse(storedHistory).forEach((item: any) => {
      defaultHistory.push({
        path: item.path ?? item,
      })
    })
  }
  const history: Ref<History[]> = ref(defaultHistory)

  const addHistory = (h: History): void => {
    // history must be unique
    let index = history.value.findIndex((item: History) => item.path === h.path)
    if (index === -1) {
      history.value.push(h)
      localStorage.setItem('history', JSON.stringify(history.value))
    }
  }

  const removeHistory = (h: History): void => {
    let index = history.value.findIndex((item: History) => item === h)
    if (index === -1) {
      return
    }
    history.value.splice(index, 1)
    localStorage.setItem('history', JSON.stringify(history.value))
  }

  return { history, addHistory, removeHistory }
})
