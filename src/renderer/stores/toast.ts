import { defineStore } from 'pinia'

export type ToastType = 'info' | 'warning' | 'error'

interface ToastState {
  message: string | null
  type: ToastType
  timeoutId: number | null
}

export const useToastStore = defineStore('toast', {
  state: (): ToastState => ({
    message: null,
    type: 'info',
    timeoutId: null,
  }),
  actions: {
    show(message: string, type: ToastType = 'info', durationMs?: number) {
      // Only one toast at a time; replace existing and reset timer
      this.message = message
      this.type = type

      if (this.timeoutId) {
        clearTimeout(this.timeoutId)
        this.timeoutId = null
      }

      if (durationMs && durationMs > 0) {
        this.timeoutId = window.setTimeout(() => {
          this.close()
        }, durationMs)
      }
    },
    close() {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId)
        this.timeoutId = null
      }
      this.message = null
    },
  },
})
