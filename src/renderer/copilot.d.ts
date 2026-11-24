import type { ICopilotApi } from '../preload/preload'

declare global {
  interface Window {
    copilotApi: ICopilotApi
  }
}
