import * as lsp from './index'

// Serialize init/restart calls: concurrent invocations (e.g. settings:store
// racing lsp:restart) would both pass the "not running" gate and listen on
// the same port, causing EADDRINUSE and a corrupted module state
let lspQueue: Promise<unknown> = Promise.resolve()

const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const run = lspQueue.then(task, task)
  lspQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

export const initLsp = (): Promise<boolean> => {
  return enqueue(() => lsp.init())
}

export const restartLsp = async (): Promise<boolean> => {
  return enqueue(async () => {
    await lsp.shutdown()
    return lsp.init()
  })
}
