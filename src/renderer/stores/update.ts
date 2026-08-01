import { ref } from 'vue'
import { defineStore } from 'pinia'
import { UpdateInfo } from 'electron-updater'
import semver from 'semver'
import { storage, repositoryStorageKeys } from '../storage'

export interface DownloadProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export const useUpdateStore = defineStore('update', () => {
  const update = ref<UpdateInfo>()
  const checking = ref(true)
  const downloading = ref(false)
  const downloadProgress = ref<DownloadProgress>({
    percent: 0,
    transferred: 0,
    total: 0,
    bytesPerSecond: 0,
  })

  const ready = storage.get<UpdateInfo>(repositoryStorageKeys.update).then(value => {
    if (value) update.value = value
  })

  const setUpdate = (info: UpdateInfo): void => {
    checking.value = false
    update.value = info
    void storage.set(repositoryStorageKeys.update, info)
  }

  const setChecking = (value: boolean): void => {
    checking.value = value
  }

  const setDownloading = (value: boolean): void => {
    downloading.value = value
  }

  const setDownloadProgress = (progress: DownloadProgress): void => {
    downloadProgress.value = progress
  }

  const resetDownloadProgress = (): void => {
    downloadProgress.value = {
      percent: 0,
      transferred: 0,
      total: 0,
      bytesPerSecond: 0,
    }
  }

  const isUpdateAvailable = (currentVersion: string, newVersion?: string) => {
    if (newVersion) {
      return semver.gt(newVersion, currentVersion)
    }

    return false
  }

  return {
    update,
    setUpdate,
    checking,
    setChecking,
    downloading,
    setDownloading,
    downloadProgress,
    setDownloadProgress,
    resetDownloadProgress,
    isUpdateAvailable,
    ready,
  }
})
