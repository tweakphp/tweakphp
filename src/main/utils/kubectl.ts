import { execSync } from 'child_process'

export class Kubectl {
  constructor() {}

  getKubeCtlPath() {
    try {
      return execSync('which kubectl').toString().trim()
    } catch (error) {
      return 'kubectl'
    }
  }

  async getContexts(): Promise<string[]> {
    try {
      const kubeCtlPath = this.getKubeCtlPath()

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

  async getNamespaces(params: { context: string }): Promise<string[]> {
    try {
      const kubeCtlPath = this.getKubeCtlPath()

      const result = execSync(
        `${kubeCtlPath} get namespaces --context="${params.context}" -o custom-columns=NAME:.metadata.name --no-headers`,
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

  async getPods(params: { context: string; namespace: string }): Promise<string[]> {
    try {
      const kubeCtlPath = this.getKubeCtlPath()

      const result = execSync(
        `${kubeCtlPath} get pods --context="${params.context}" --namespace="${params.namespace}" --field-selector=status.phase=Running -o custom-columns=NAME:.metadata.name --no-headers`,
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

  async exec(command: string, params: { pod: string; context: string; namespace: string }): Promise<string> {
    try {
      const kubeCtlPath = this.getKubeCtlPath()

      return execSync(
        `${kubeCtlPath} exec ${params.pod} --context="${params.context}" --namespace="${params.namespace}" -- ${command}`
      )
        .toString()
        .trim()
    } catch (error: any) {
      throw new Error(error)
    }
  }

  async uploadFile(
    localPath: string,
    remotePath: string,
    params: {
      pod: string
      context: string
      namespace: string
    }
  ): Promise<void> {
    try {
      const kubeCtlPath = this.getKubeCtlPath()

      execSync(
        `${kubeCtlPath} cp "${localPath}" ${params.pod}:${remotePath} --context="${params.context}" --namespace="${params.namespace}"`
      )
    } catch (error: any) {
      throw new Error(error)
    }
  }
}
