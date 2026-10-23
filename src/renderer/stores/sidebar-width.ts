import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { repositoryStorageKeys, storage } from '../storage'

export const DEFAULT_SIDEBAR_WIDTH = 288
export const MIN_SIDEBAR_WIDTH = 192
export const MAX_SIDEBAR_WIDTH = 480
const MIN_CONTENT_WIDTH = 320
const COLLAPSED_SIDEBAR_WIDTH = 48

export const sidebarWidthBounds = (viewportWidth: number) => {
  const max = Math.max(COLLAPSED_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, viewportWidth - MIN_CONTENT_WIDTH))
  return { min: Math.min(MIN_SIDEBAR_WIDTH, max), max }
}

export const clampSidebarWidth = (width: number, viewportWidth: number): number => {
  const { min, max } = sidebarWidthBounds(viewportWidth)
  return Math.min(max, Math.max(min, Math.round(width)))
}

export const useSidebarWidthStore = defineStore('sidebar-width', () => {
  // Keep the preferred width even when the window is made smaller: the
  // effective width is constrained to the available space by App.vue.
  const width = ref(DEFAULT_SIDEBAR_WIDTH)

  const ready = storage.get<number>(repositoryStorageKeys.sidebarWidth).then(storedWidth => {
    if (typeof storedWidth === 'number' && Number.isFinite(storedWidth)) {
      width.value = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(storedWidth)))
    }
  })

  const setWidth = (value: number) => {
    if (Number.isFinite(value)) {
      width.value = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(value)))
    }
  }

  const persistWidth = () => storage.set(repositoryStorageKeys.sidebarWidth, width.value)

  return { width: computed(() => width.value), ready, setWidth, persistWidth }
})
