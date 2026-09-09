import * as lsp from './index'

export const initLsp = (): Promise<boolean> => {
  return lsp.init()
}

export const restartLsp = async (): Promise<boolean> => {
  await lsp.shutdown()
  return lsp.init()
}
