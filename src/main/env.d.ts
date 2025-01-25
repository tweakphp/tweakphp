/// <reference types="vite-plugin-electron/electron-env" />

import { IpcRenderer, PlatformInfo } from '../preload/preload'

declare namespace NodeJS {
  interface ProcessEnv {
    DEV: boolean
    CLIENT_PATH: string
    VITE_PORT: string
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}
