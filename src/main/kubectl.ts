import { execSync } from 'child_process'
import { ipcMain } from 'electron'

export const getKubeCtlPath = async () => {
  try {
    return execSync('which kubectl').toString().trim()
  } catch (error) {
    return 'kubectl'
  }
}

export const init = async () => {
  ipcMain.on('kubectl.contexts', async event => {
    try {
      const contexts = await getContexts()
      event.reply('kubectl.contexts.reply', { contexts })
    } catch (error: unknown) {
      event.reply('kubectl.contexts.reply', { error })
    }
  })

  ipcMain.on('kubectl.namespaces', async (event: any, data: any) => {
    try {
      const namespaces = await getNamespaces(data.context)
      event.reply('kubectl.namespaces.reply', { namespaces })
    } catch (error: unknown) {
      event.reply('kubectl.namespaces.reply', { error })
    }
  })

  ipcMain.on('kubectl.pods', async (event: any, data: any) => {
    try {
      const pods = await getPods(data.context, data.namespace)
      event.reply('kubectl.pods.reply', { pods })
    } catch (error: unknown) {
      event.reply('kubectl.pods.reply', { error })
    }
  })
}

export const getContexts = async (): Promise<string[]> => {
  try {
    const kubeCtlPath = await getKubeCtlPath()

    const result = execSync(`${kubeCtlPath} config get-contexts -o name`, {
      encoding: 'utf-8',
    }).trim()

    if (result) {
      return result.split('\n')
    }

    return []
  } catch (error: any) {
    throw new Error(error)
  }
}

export const getNamespaces = async (context: string): Promise<string[]> => {
  try {
    const kubeCtlPath = await getKubeCtlPath()

    const result = execSync(`${kubeCtlPath} get namespaces --context="${context}" -o custom-columns=NAME:.metadata.name --no-headers`, {
      encoding: 'utf-8',
    }).trim()

    if (result) {
      return result.split('\n')
    }

    return []
  } catch (error: any) {
    throw new Error(error)
  }
}

export const getPods = async (context: string, namespace: string): Promise<string[]> => {
  try {
    const kubeCtlPath = await getKubeCtlPath()

    const result = execSync(`${kubeCtlPath} get pods --context="${context}" --namespace="${namespace}" -o custom-columns=NAME:.metadata.name --no-headers`, {
      encoding: 'utf-8',
    }).trim()

    if (result) {
      return result.split('\n')
    }

    return []
  } catch (error: any) {
    throw new Error(error)
  }
}