import type * as monaco from 'monaco-editor'

export interface IHistoryApi {
  add: (tabId: number, code: string, cursor: monaco.IPosition) => void
  undo: (tabId: number) => void
  redo: (tabId: number) => void
  onUndoReply: (callback: (data: { code: string; cursor?: monaco.IPosition }) => void) => void
  onRedoReply: (callback: (data: { code: string; cursor?: monaco.IPosition }) => void) => void
  removeAllListeners: () => void
}

declare global {
  interface Window {
    historyApi: IHistoryApi
  }
}
