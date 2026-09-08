import * as lsp from './index'

export const initLsp = (): Promise<void> => {
  return lsp.init()
}

export const restartLsp = async (): Promise<void> => {
  await lsp.shutdown()
  await lsp.init()
}
