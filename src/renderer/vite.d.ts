/// <reference types="vite/client" />

import { IpcRenderer, PlatformInfo } from '../preload/preload'
declare global {
  // Used in Renderer process, expose in `preload.ts`
  interface Window {
    ipcRenderer: IpcRenderer
    platformInfo: PlatformInfo
    Sfdump: any
  }
}
