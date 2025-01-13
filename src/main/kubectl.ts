import { execSync } from 'child_process'
import { app, ipcMain, Notification } from 'electron'
import { ConnectionConfig } from '../types/kubectl.type'
import path from 'path'

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
    } catch (error: any) {
      event.reply('kubectl.namespaces.reply', { error })
      new Notification({
        title: 'Error',
        body: error.message,
      }).show()
    }
  })

  ipcMain.on('kubectl.pods', async (event: any, data: any) => {
    try {
      const pods = await getPods(data.context, data.namespace)
      event.reply('kubectl.pods.reply', { pods })
    } catch (error: any) {
      event.reply('kubectl.pods.reply', { error })
      new Notification({
        title: 'Error',
        body: error.message,
      }).show()
    }
  })

  ipcMain.on('kubectl.connect', async (event: any, connection: ConnectionConfig, data: any) => {
    try {
      await connect(connection)
      event.reply('kubectl.connect.reply', {
        connected: true,
        connection: connection,
        data: data,
      })
    } catch (error: any) {
      event.reply('kubectl.connect.reply', {
        connected: false,
        connection: connection,
        data: data,
        error: error,
      })
      new Notification({
        title: 'Error',
        body: error.message,
      }).show()
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

    const result = execSync(
      `${kubeCtlPath} get namespaces --context="${context}" -o custom-columns=NAME:.metadata.name --no-headers`,
      {
        encoding: 'utf-8',
      }
    ).trim()

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

    const result = execSync(
      `${kubeCtlPath} get pods --context="${context}" --namespace="${namespace}" --field-selector=status.phase=Running -o custom-columns=NAME:.metadata.name --no-headers`,
      {
        encoding: 'utf-8',
      }
    ).trim()

    if (result) {
      return result.split('\n')
    }

    return []
  } catch (error: any) {
    throw new Error(error)
  }
}

export const connect = async (connection: ConnectionConfig) => {
  try {
    // get php version
    const phpVersion = (
      await exec(connection, `php -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . PHP_EOL;"`)
    ).trim()
    if (parseFloat(phpVersion) < 7.4) {
      throw new Error('PHP version must be at least 7.4')
    }
    connection.php = phpVersion

    // upload phar client
    const homePath = (await exec(connection, `sh -c 'echo $HOME'`)).trim()
    const pharClientRemotePath = `${homePath}/.tweakphp/client-${phpVersion}.phar`
    const pharClientLocalPath = app.isPackaged
      ? path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
      : path.join(__dirname, `../public/client-${phpVersion}.phar`)
    const checkClient = (await exec(connection, `[ -e "${pharClientRemotePath}" ] || echo "not_found"`)).trim()
    if (checkClient == 'not_found') {
      await exec(connection, `mkdir -p ${homePath}/.tweakphp`)
      await uploadFile(connection, pharClientLocalPath, pharClientRemotePath)
    }
    connection.phar_client = pharClientRemotePath
  } catch (error: any) {
    throw new Error(error)
  }
}

export const exec = async (connection: ConnectionConfig, command: string): Promise<string> => {
  try {
    const kubeCtlPath = await getKubeCtlPath()

    return execSync(
      `${kubeCtlPath} exec ${connection.pod} --context="${connection.context}" --namespace="${connection.namespace}" -- ${command}`
    )
      .toString()
      .trim()
  } catch (error: any) {
    throw new Error(error)
  }
}

export const uploadFile = async (
  connection: ConnectionConfig,
  localPath: string,
  remotePath: string
): Promise<void> => {
  try {
    const kubeCtlPath = await getKubeCtlPath()

    execSync(
      `${kubeCtlPath} cp "${localPath}" ${connection.pod}:${remotePath} --context="${connection.context}" --namespace="${connection.namespace}"`
    )
  } catch (error: any) {
    throw new Error(error)
  }
}
