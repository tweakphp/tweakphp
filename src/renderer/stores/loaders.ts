import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import { Loader } from '../../types/loader.type'

export const useLodaersStore = defineStore('loaders', () => {
  let storedLoaders: Loader[] = []
  const storedLoadersRaw = localStorage.getItem('loaders')
  if (storedLoadersRaw) {
    storedLoaders = JSON.parse(storedLoadersRaw).map((loader: any) => {
      return normalize(loader)
    })
  }
  const loaders: Ref<Loader[]> = ref(storedLoaders)

  const get = (name: string): Loader | undefined => {
    return loaders.value.find(l => l.name === name)
  }

  const add = (loader: Loader) => {
    loaders.value.push(loader)
    localStorage.setItem('loaders', JSON.stringify(loaders.value))
  }

  const update = (loader: Loader): void => {
    const index = loaders.value.findIndex(l => l.name === loader.name)
    if (index !== -1) {
      loaders.value[index] = loader
    } else {
      loaders.value.push(loader)
    }
    localStorage.setItem('loaders', JSON.stringify(loaders.value))
  }

  const remove = (name: string) => {
    const index = loaders.value.findIndex(l => l.name === name)
    if (index !== -1) {
      loaders.value.splice(index, 1)
      localStorage.setItem('loaders', JSON.stringify(loaders.value))
    }
  }

  return { loaders, get, remove, add, update }
})

const normalize = (loader: any): any => {
  return {
    name: loader.name ?? '',
    code: loader.code ?? '',
  }
}
