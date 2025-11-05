import { ref } from 'vue'
import { defineStore } from 'pinia'
import { UpdateInfo } from 'electron-updater'
import semver from 'semver'

export const useUpdateStore = defineStore('update', () => {
  const update = ref<UpdateInfo>()
  const checking = ref(true)

  let storedUpdate = localStorage.getItem('update')
  if (storedUpdate && storedUpdate !== 'undefined' && storedUpdate !== 'null') {
    try {
      update.value = JSON.parse(storedUpdate)
    } catch (error) {
      localStorage.removeItem('update') // Clean up invalid data
    }
  }

  const setUpdate = (info: UpdateInfo): void => {
    checking.value = false
    update.value = info
    localStorage.setItem('update', JSON.stringify(info))
  }

  const setChecking = (value: boolean): void => {
    checking.value = value
  }

  const isUpdateAvailable = (currentVersion: string, newVersion?: string) => {
    if (newVersion) {
      return semver.gt(newVersion, currentVersion)
    }

    return false
  }

  return { update, setUpdate, checking, setChecking, isUpdateAvailable }
})
