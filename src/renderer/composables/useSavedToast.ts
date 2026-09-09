import { ref } from 'vue'
import { onBeforeUnmount } from 'vue'

const TOAST_DURATION_MS = 2000

/**
 * Shared "Settings Saved" feedback: a transient `saved`/`showToast` flag pair
 * with a single auto-reset timer. Previously duplicated (with duplicated
 * timers) in the settings views.
 */
export function useSavedToast() {
  const saved = ref(false)
  const showToast = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  const markSaved = () => {
    saved.value = true
    showToast.value = true
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      saved.value = false
      showToast.value = false
      timer = null
    }, TOAST_DURATION_MS)
  }

  onBeforeUnmount(() => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  })

  return { saved, showToast, markSaved }
}
