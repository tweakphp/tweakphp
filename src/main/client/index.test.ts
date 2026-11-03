import { describe, it, expect, vi, beforeEach } from 'vitest'
import { init } from './index'
import { ipcMain } from 'electron'

// Prefix variable names with "mock" to allow referencing inside hoisted vi.mock factories
const mockConnect = vi.fn()
const mockSetup = vi.fn()
const mockDisconnect = vi.fn()
const mockExecute = vi.fn()
const mockExecuteStreaming = vi.fn()
const mockStop = vi.fn()
const mockInfo = vi.fn()
const mockAction = vi.fn()
const mockShow = vi.fn()

vi.mock('./local', () => ({
  LocalClient: class {
    conn: any
    constructor(conn: any) {
      this.conn = conn
    }
    connect = mockConnect
    setup = mockSetup
    disconnect = mockDisconnect
    execute = mockExecute
    info = mockInfo
    action = mockAction
    getConnection() {
      return this.conn
    }
  },
}))

vi.mock('./ssh', () => ({
  SSHClient: class {
    conn: any
    constructor(conn: any) {
      this.conn = conn
    }
    connect = mockConnect
    setup = mockSetup
    disconnect = mockDisconnect
    execute = mockExecute
    info = mockInfo
    action = mockAction
    getConnection() {
      return this.conn
    }
  },
}))

vi.mock('./vapor', () => ({
  VaporClient: class {
    conn: any
    constructor(conn: any) {
      this.conn = conn
    }
    connect = mockConnect
    setup = mockSetup
    disconnect = mockDisconnect
    execute = mockExecute
    info = mockInfo
    action = mockAction
    getConnection() {
      return this.conn
    }
  },
}))

vi.mock('./docker', () => ({
  __esModule: true,
  default: class {
    conn: any
    constructor(conn: any) {
      this.conn = conn
    }
    connect = mockConnect
    setup = mockSetup
    disconnect = mockDisconnect
    execute = mockExecute
    executeStreaming = mockExecuteStreaming
    stop = mockStop
    info = mockInfo
    action = mockAction
    getConnection() {
      return this.conn
    }
  },
}))

vi.mock('./kubectl', () => ({
  __esModule: true,
  default: class {
    conn: any
    constructor(conn: any) {
      this.conn = conn
    }
    connect = mockConnect
    setup = mockSetup
    disconnect = mockDisconnect
    execute = mockExecute
    info = mockInfo
    action = mockAction
    getConnection() {
      return this.conn
    }
  },
}))

const ipcHandlers: Record<string, Function> = {}
const mockIpcOn = vi.fn().mockImplementation((event: string, callback: Function) => {
  ipcHandlers[event] = callback
})

vi.mock('electron', () => {
  return {
    ipcMain: {
      on: (event: string, cb: Function) => mockIpcOn(event, cb),
    },
    Notification: class {
      constructor() {}
      show = mockShow
    },
  }
})

describe('IPC Router (index.ts)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await init()
  })

  it('init registers all IPC handlers', () => {
    expect(mockIpcOn).toHaveBeenCalledWith('client.connect', expect.any(Function))
    expect(mockIpcOn).toHaveBeenCalledWith('client.execute', expect.any(Function))
    expect(mockIpcOn).toHaveBeenCalledWith('client.execute.stop', expect.any(Function))
    expect(mockIpcOn).toHaveBeenCalledWith('client.action', expect.any(Function))
    expect(mockIpcOn).toHaveBeenCalledWith('client.info', expect.any(Function))
  })

  describe('connect handler', () => {
    it('successfully connects and setups the client', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'local' }, data: { setup: true } }

      mockConnect.mockResolvedValue(undefined)
      mockSetup.mockResolvedValue(undefined)

      await ipcHandlers['client.connect'](mockEvent, payload)

      expect(mockConnect).toHaveBeenCalled()
      expect(mockSetup).toHaveBeenCalled()
      expect(mockEvent.reply).toHaveBeenCalledWith('client.connect.reply', {
        connected: true,
        connection: { type: 'local' },
        data: payload.data,
      })
      expect(mockDisconnect).toHaveBeenCalled()
    })

    it('replies with error and shows Notification on failure', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'local' }, data: { setup: false } }
      const errorObj = new Error('Connection failed')

      mockConnect.mockRejectedValue(errorObj)

      await ipcHandlers['client.connect'](mockEvent, payload)

      expect(mockEvent.reply).toHaveBeenCalledWith('client.connect.reply', {
        connected: false,
        connection: { type: 'local' },
        data: payload.data,
        error: errorObj,
      })
      expect(mockShow).toHaveBeenCalled()
      expect(mockDisconnect).toHaveBeenCalled()
    })
  })

  describe('execute handler', () => {
    it('successfully executes command and parses TWEAKPHP_RESULT payload', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'local' }, code: 'echo 1;', loader: 'my-loader', tabId: 5 }

      mockConnect.mockResolvedValue(undefined)
      mockExecute.mockResolvedValue('Some output\nTWEAKPHP_RESULT:{"val": 42}\n')

      await ipcHandlers['client.execute'](mockEvent, payload)

      expect(mockConnect).toHaveBeenCalled()
      expect(mockExecute).toHaveBeenCalledWith('echo 1;', 'my-loader')
      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.reply', { tabId: 5, output: { val: 42 } })
      expect(mockDisconnect).toHaveBeenCalled()
    })

    it('replies with raw execution results if TWEAKPHP_RESULT format is missing', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'local' }, code: 'echo 1;', tabId: 5 }

      mockConnect.mockResolvedValue(undefined)
      mockExecute.mockResolvedValue('Raw output\n')

      await ipcHandlers['client.execute'](mockEvent, payload)

      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.reply', { tabId: 5, output: 'Raw output' })
    })

    it('replies with raw string payload when TWEAKPHP_RESULT is not valid JSON', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'local' }, code: 'echo 1;', tabId: 5 }

      mockConnect.mockResolvedValue(undefined)
      mockExecute.mockResolvedValue('TWEAKPHP_RESULT:not-json-payload\n')

      await ipcHandlers['client.execute'](mockEvent, payload)

      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.reply', { tabId: 5, output: 'not-json-payload' })
    })

    it('parses TWEAKPHP_ERROR JSON payload and replies with structured error result', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'local' }, code: 'echo 1;', tabId: 5 }

      mockConnect.mockResolvedValue(undefined)
      mockExecute.mockResolvedValue(
        'TWEAKPHP_ERROR:{"class":"ParseError","message":"syntax error, unexpected end of file","line":3}\n'
      )

      await ipcHandlers['client.execute'](mockEvent, payload)

      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.reply', {
        tabId: 5,
        output: {
          output: [
            {
              line: 3,
              code: '',
              output: 'ParseError: syntax error, unexpected end of file',
              html: '<div class="text-red-500 font-semibold">ParseError: syntax error, unexpected end of file</div>',
            },
          ],
        },
      })
    })

    it('parses TWEAKPHP_ERROR plain-text payload and extracts the line number', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'local' }, code: 'echo 1;', tabId: 5 }

      mockConnect.mockResolvedValue(undefined)
      mockExecute.mockResolvedValue('TWEAKPHP_ERROR:PHP Fatal error: something bad on line 7\n')

      await ipcHandlers['client.execute'](mockEvent, payload)

      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.reply', {
        tabId: 5,
        output: {
          output: [
            {
              line: 7,
              code: '',
              output: 'PHP Fatal error: something bad on line 7',
              html: '<div class="text-red-500 font-semibold">PHP Fatal error: something bad on line 7</div>',
            },
          ],
        },
      })
    })

    it('replies with error on failure', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'local' }, code: 'echo 1;', tabId: 5 }

      mockConnect.mockRejectedValue(new Error('Exec failed'))

      await ipcHandlers['client.execute'](mockEvent, payload)

      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.reply', { tabId: 5, error: expect.any(Error) })
    })
  })

  describe('execute handler streaming path', () => {
    it('forwards stream events and replies with streamingDone', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'docker' }, code: 'echo 1;', loader: '', tabId: 7 }

      mockConnect.mockResolvedValue(undefined)
      mockExecuteStreaming.mockImplementation(async (_code: string, _loader: string, onEvent: Function) => {
        onEvent({ type: 'statement.started', index: 0, line: 1, code: 'echo 1;' })
        onEvent({ type: 'output', index: 0, data: '1' })
      })

      await ipcHandlers['client.execute'](mockEvent, payload)

      expect(mockExecuteStreaming).toHaveBeenCalledWith('echo 1;', '', expect.any(Function), expect.any(Function))
      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.stream', {
        tabId: 7,
        event: { type: 'started' },
      })
      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.stream', {
        tabId: 7,
        event: { type: 'output', index: 0, data: '1' },
      })
      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.reply', { tabId: 7, streamingDone: true })
      expect(mockDisconnect).toHaveBeenCalled()
    })

    it('stops a running execution using the pid reported by the client', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'docker' }, code: 'sleep 30;', tabId: 8 }

      mockConnect.mockResolvedValue(undefined)
      mockStop.mockResolvedValue(undefined)
      let release: () => void = () => {}
      const gate = new Promise<void>(resolve => {
        release = resolve
      })
      mockExecuteStreaming.mockImplementation(async (_code: string, _loader: string, onEvent: Function) => {
        onEvent({ type: 'started', pid: 4321 })
        await gate
      })

      const running = ipcHandlers['client.execute'](mockEvent, payload)
      await vi.waitFor(() => expect(mockExecuteStreaming).toHaveBeenCalled())

      await ipcHandlers['client.execute.stop']({ reply: vi.fn() }, { tabId: 8 })
      expect(mockStop).toHaveBeenCalledWith(4321, 'TERM')

      release()
      await running

      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.stream', {
        tabId: 8,
        event: { type: 'output', index: 0, data: 'Execution stopped by user' },
      })
      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.reply', { tabId: 8, streamingDone: true })
    })

    it('replies with the stopped message when streaming fails because of a stop', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'docker' }, code: 'sleep 30;', tabId: 9 }

      mockConnect.mockResolvedValue(undefined)
      mockStop.mockResolvedValue(undefined)
      let rejectStreaming: (error: Error) => void = () => {}
      mockExecuteStreaming.mockImplementation(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectStreaming = reject
          })
      )

      const running = ipcHandlers['client.execute'](mockEvent, payload)
      await vi.waitFor(() => expect(mockExecuteStreaming).toHaveBeenCalled())

      await ipcHandlers['client.execute.stop']({ reply: vi.fn() }, { tabId: 9 })
      rejectStreaming(new Error('Docker exited with code 137'))

      await running

      expect(mockEvent.reply).not.toHaveBeenCalledWith('client.execute.reply', expect.any(Error))
      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.stream', {
        tabId: 9,
        event: { type: 'output', index: 0, data: 'Execution stopped by user' },
      })
      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.reply', { tabId: 9, streamingDone: true })
    })

    it('ignores stop requests without a numeric tabId', async () => {
      await expect(ipcHandlers['client.execute.stop']({ reply: vi.fn() }, { tabId: 'abc' })).resolves.toBeUndefined()
      await expect(ipcHandlers['client.execute.stop']({ reply: vi.fn() }, {})).resolves.toBeUndefined()
    })

    it('does not start streaming when the execution was stopped during connect', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'docker' }, code: 'sleep 30;', tabId: 11 }

      let releaseConnect: () => void = () => {}
      mockConnect.mockImplementation(
        () =>
          new Promise<void>(resolve => {
            releaseConnect = resolve
          })
      )
      mockStop.mockResolvedValue(undefined)

      const running = ipcHandlers['client.execute'](mockEvent, payload)
      await vi.waitFor(() => expect(mockConnect).toHaveBeenCalled())

      await ipcHandlers['client.execute.stop']({ reply: vi.fn() }, { tabId: 11 })
      releaseConnect()
      await running

      expect(mockExecuteStreaming).not.toHaveBeenCalled()
      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.stream', {
        tabId: 11,
        event: { type: 'output', index: 0, data: 'Execution stopped by user' },
      })
      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.reply', { tabId: 11, streamingDone: true })
    })

    it('replies with streamingDone when stopping an execution that is no longer running', async () => {
      const mockEvent = { reply: vi.fn() }

      await ipcHandlers['client.execute.stop'](mockEvent, { tabId: 555 })

      expect(mockEvent.reply).toHaveBeenCalledWith('client.execute.reply', { tabId: 555, streamingDone: true })
    })
  })

  describe('action handler', () => {
    it('successfully runs actions and replies', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'local' }, type: 'myAction', data: 'myData' }

      mockConnect.mockResolvedValue(undefined)
      mockAction.mockResolvedValue('actionResult')

      await ipcHandlers['client.action'](mockEvent, payload)

      expect(mockAction).toHaveBeenCalledWith('myAction', 'myData')
      expect(mockEvent.reply).toHaveBeenCalledWith('client.action.reply', {
        type: 'myAction',
        result: 'actionResult',
      })
    })

    it('replies with error on action failure', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'local' }, type: 'myAction' }

      mockConnect.mockResolvedValue(undefined)
      mockAction.mockRejectedValue(new Error('Action failed'))

      await ipcHandlers['client.action'](mockEvent, payload)

      expect(mockEvent.reply).toHaveBeenCalledWith('client.action.reply', {
        type: 'myAction',
        error: expect.any(Error),
      })
    })
  })

  describe('info handler', () => {
    it('successfully gets info and replies', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'local' }, loader: 'my-loader' }

      mockConnect.mockResolvedValue(undefined)
      mockInfo.mockResolvedValue('info-result')

      await ipcHandlers['client.info'](mockEvent, payload)

      expect(mockInfo).toHaveBeenCalledWith('my-loader')
      expect(mockEvent.reply).toHaveBeenCalledWith('client.info.reply', 'info-result')
    })

    it('throws error on info failure', async () => {
      const mockEvent = { reply: vi.fn() }
      const payload = { connection: { type: 'local' } }

      mockConnect.mockResolvedValue(undefined)
      mockInfo.mockRejectedValue(new Error('Info failed'))

      await expect(ipcHandlers['client.info'](mockEvent, payload)).rejects.toThrow('Info failed')
    })
  })

  describe('getClient factory mappings', () => {
    it('creates appropriate Client instance based on type', async () => {
      const mockEvent = { reply: vi.fn() }

      mockConnect.mockResolvedValue(undefined)
      mockInfo.mockResolvedValue('info-result')

      await ipcHandlers['client.info'](mockEvent, { connection: { type: 'local' } })
      await ipcHandlers['client.info'](mockEvent, { connection: { type: 'docker' } })
      await ipcHandlers['client.info'](mockEvent, { connection: { type: 'vapor' } })
      await ipcHandlers['client.info'](mockEvent, { connection: { type: 'ssh' } })
      await ipcHandlers['client.info'](mockEvent, { connection: { type: 'kubectl' } })
    })

    it('throws error if type is not supported', async () => {
      const mockEvent = { reply: vi.fn() }
      await expect(ipcHandlers['client.info'](mockEvent, { connection: { type: 'unsupported' } })).rejects.toThrow(
        'Type not supported'
      )
    })

    it('throws error if connection object is missing', async () => {
      const mockEvent = { reply: vi.fn() }
      await expect(ipcHandlers['client.info'](mockEvent, {})).rejects.toThrow('Connection is required')
    })
  })
})
