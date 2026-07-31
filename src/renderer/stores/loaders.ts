import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import { Loader } from '../../types/loader.type'
import { toPlain } from '../storage'

export const useLoadersStore = defineStore('loaders', () => {
  const loaders: Ref<Loader[]> = ref([])
  const ready = window.ipcRenderer.invoke('storage:loaders:list').then((stored: any[]) => {
    loaders.value = stored.map(normalize)
  })

  const get = (name: string): Loader | undefined => {
    return loaders.value.find(l => l.name === name)
  }

  const add = (loader: Loader) => {
    loaders.value.push(loader)
    void window.ipcRenderer.invoke('storage:loaders:save', toPlain(loader))
  }

  const update = (loader: Loader): void => {
    const index = loaders.value.findIndex(l => l.name === loader.name)
    if (index !== -1) {
      loaders.value[index] = loader
    } else {
      loaders.value.push(loader)
    }
    void window.ipcRenderer.invoke('storage:loaders:save', toPlain(loader))
  }

  const remove = (name: string) => {
    const index = loaders.value.findIndex(l => l.name === name)
    if (index !== -1) {
      loaders.value.splice(index, 1)
      void window.ipcRenderer.invoke('storage:loaders:delete', name)
    }
  }

  return { loaders, get, remove, add, update, ready }
})

const normalize = (loader: any): any => {
  return {
    name: loader.name ?? '',
    code: loader.code ?? '',
  }
}
