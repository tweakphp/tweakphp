import { ipcMain, Notification } from 'electron'
import { LocalClient } from './local'
import { SSHClient } from './ssh'
import { Client } from './client.interface'
import { VaporClient } from './vapor'
import DockerClient from './docker'
import KubectlClient from './kubectl'

export const init = async () => {
  ipcMain.on('client.connect', connect)
  ipcMain.on('client.execute', execute)
  ipcMain.on('client.action', action)
  ipcMain.on('client.info', info)
}

const connect = async (event: Electron.IpcMainEvent, payload: any) => {
  const client = getClient(payload)
  try {
    await client.connect()
    if (payload.data?.setup) {
      await client.setup()
    }
    event.reply('client.connect.reply', {
      connected: true,
      connection: client.getConnection(),
      data: payload.data,
    })
  } catch (error: any) {
    event.reply('client.connect.reply', {
      connected: false,
      connection: client.getConnection(),
      data: payload.data,
      error,
    })
    new Notification({
      title: 'Error',
      body: error.message ?? error,
    }).show()
  } finally {
    client.disconnect()
  }
}

const execute = async (event: Electron.IpcMainEvent, payload: any) => {
  const client = getClient(payload)
  try {
    await client.connect()

    if (payload.streaming && typeof client.executeStreaming === 'function') {
      event.reply('client.execute.stream', {
        tabId: payload.tabId,
        event: { type: 'started' },
      })

      await client.executeStreaming(payload.code, payload.loader, (streamEvent: any) => {
        event.reply('client.execute.stream', {
          tabId: payload.tabId,
          event: streamEvent,
        })
      })

      event.reply('client.execute.reply', { streamingDone: true })
      return
    }

    let result = await client.execute(payload.code, payload.loader)
    result = result.trim()
    let output: any = null

    if (result.includes('TWEAKPHP_ERROR:')) {
      const errorContent = result.split('TWEAKPHP_ERROR:')[1]?.trim() ?? ''
      let parsedError: any = null
      try {
        parsedError = JSON.parse(errorContent)
      } catch (e) {
        parsedError = errorContent
      }

      let message = ''
      let line = 0

      if (typeof parsedError === 'object' && parsedError !== null) {
        const errorClass = parsedError.class || ''
        const errorMsg = parsedError.message || ''
        message =
          errorClass && errorMsg ? `${errorClass}: ${errorMsg}` : errorMsg || errorClass || JSON.stringify(parsedError)

        if (parsedError.line) {
          line = Number(parsedError.line)
        } else {
          const lineMatch = message.match(/on line (\d+)/i) || errorContent.match(/on line (\d+)/i)
          if (lineMatch) {
            line = parseInt(lineMatch[1], 10)
          }
        }
      } else {
        message = String(parsedError || errorContent || result)
        const lineMatch = message.match(/on line (\d+)/i)
        if (lineMatch) {
          line = parseInt(lineMatch[1], 10)
        }
      }

      const escapedMessage = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')

      output = {
        output: [
          {
            line: line,
            code: '',
            output: message,
            html: `<div class="text-red-500 font-semibold">${escapedMessage}</div>`,
          },
        ],
      }
    } else {
      let outputStr = result.split('TWEAKPHP_RESULT:')[1]?.trim()
      if (outputStr) {
        try {
          output = JSON.parse(outputStr)
        } catch (error: any) {
          //
        }
      }
    }

    event.reply('client.execute.reply', output ?? result)
  } catch (error: any) {
    event.reply('client.execute.reply', error)
  } finally {
    client.disconnect()
  }
}

const action = async (event: Electron.IpcMainEvent, payload: any) => {
  const client = getClient(payload)
  try {
    await client.connect()
    const result = await client.action(payload.type, payload.data)
    event.reply('client.action.reply', {
      type: payload.type,
      result,
    })
  } catch (error: any) {
    event.reply('client.action.reply', {
      type: payload.type,
      error,
    })
  } finally {
    client.disconnect()
  }
}

const info = async (event: Electron.IpcMainEvent, data: any) => {
  const client = getClient(data)
  try {
    await client.connect()
    const result = await client.info(data.loader)
    event.reply('client.info.reply', result)
  } catch (error: any) {
    throw new Error(error)
  } finally {
    client.disconnect()
  }
}

const getClient = (data: any): Client => {
  if (!data.connection) {
    throw new Error('Connection is required')
  }

  if (data.connection.type === 'local') {
    return new LocalClient(data.connection)
  }

  if (data.connection.type === 'docker') {
    return new DockerClient(data.connection)
  }

  if (data.connection.type === 'vapor') {
    return new VaporClient(data.connection)
  }

  if (data.connection.type === 'ssh') {
    return new SSHClient(data.connection)
  }

  if (data.connection.type === 'kubectl') {
    return new KubectlClient(data.connection)
  }

  throw new Error('Type not supported')
}
