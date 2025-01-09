import { ipcMain } from 'electron'
import { DockerContainerResponse } from './types/docker.type.ts'
import * as ssh from "./ssh.ts";
import {ConnectionConfig} from "../types/ssh.type.ts";

export const DOCKER_PATH = '/usr/bin/docker'

export const init = async () => {
  ipcMain.on('docker.ssh.containers.info', async (event, args) => {
    try {
      const containers = await getDockerContainers(args)

      event.reply('docker.ssh.containers.reply', containers)
    } catch (error: unknown) {
      event.reply('docker.ssh.containers.reply.error', { error })
    }
  })

}

export const getDockerContainers = async (connection: ConnectionConfig): Promise<DockerContainerResponse[] | null> => {
  try {

    const command = `${DOCKER_PATH} ps --format "{{.ID}}|{{.Names}}|{{.Image}}"`

    const result = await ssh.exec(connection, command)

    if (result) {
      return result.split('\n').map(line => {
        const [id, name, image] = line.split('|')
        return {id, name, image}
      })
    }

    return null
  } catch (error: unknown) {
    console.error(error)
    throw new Error(parseDockerErrorMessage(error))
  }
}

const parseDockerErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const endIndex = error.message.indexOf("See 'docker")
    return endIndex !== -1 ? error.message.slice(0, endIndex).trim() : error.message
  }

  return 'An unknown error occurred'
}
