/**
 * Execute With Loader Tool Handler
 * Executes PHP code with framework context (Laravel/Symfony)
 */

import * as fs from 'fs'
import * as path from 'path'
import { Client } from '../../client/client.interface'
import { BaseExecuteHandler, ExecuteParams, ExecuteToolResult } from './execute-base'
import { ConnectionManager } from '../connection-manager'
import { ExecutionHistoryRepository } from '../../db/repositories/execution-history-repository'
import { MCPError, MCPErrorCode } from '../types'
import { getSettings } from '../../settings'
import { MCP_LOADER_EXECUTION_TIMEOUT_MS } from '../../constants'

interface ExecuteWithLoaderParams extends ExecuteParams {
  loader: string
  projectPath?: string
}

interface ExecuteWithLoaderContext {
  projectPath: string
  frameworkDetected: boolean
}

export interface ExecuteWithLoaderResult extends ExecuteToolResult {
  loader: string
  frameworkDetected?: boolean
}

export class ExecuteWithLoaderHandler extends BaseExecuteHandler<ExecuteWithLoaderParams, ExecuteWithLoaderContext> {
  protected readonly operation = 'execute_with_loader'
  protected readonly defaultTimeout = MCP_LOADER_EXECUTION_TIMEOUT_MS // 60 seconds for framework bootstrapping

  constructor(connectionManager: ConnectionManager, historyDB: ExecutionHistoryRepository) {
    super(connectionManager, historyDB)
  }

  protected validate(params: ExecuteWithLoaderParams): void {
    super.validate(params)

    if (!params.loader || !['laravel', 'symfony'].includes(params.loader)) {
      throw this.errorHandler.createError(
        MCPErrorCode.INVALID_PARAMETERS,
        'Parameter "loader" must be either "laravel" or "symfony"'
      )
    }
  }

  protected async prepare(params: ExecuteWithLoaderParams, connection: any): Promise<ExecuteWithLoaderContext> {
    // Detect framework if no project path provided
    let projectPath = params.projectPath
    let frameworkDetected = false

    if (!projectPath) {
      projectPath = this.detectFramework(params.loader, connection)
      frameworkDetected = true
    }

    // Validate framework exists at path
    if (projectPath && !this.validateFrameworkPath(params.loader, projectPath, connection)) {
      throw this.errorHandler.createError(
        MCPErrorCode.EXECUTION_ERROR,
        `Failed to initialize ${params.loader} framework`,
        {
          reason: 'Framework files not found at specified path',
          projectPath,
          loader: params.loader,
          troubleshooting: [
            'Verify the project path is correct',
            'Ensure composer dependencies are installed (run: composer install)',
            `Check that ${params.loader === 'laravel' ? 'artisan' : 'bin/console'} file exists`,
            'Verify vendor/autoload.php is present',
          ],
        }
      )
    }

    return { projectPath: projectPath!, frameworkDetected }
  }

  protected async executeClient(
    client: Client,
    params: ExecuteWithLoaderParams,
    _context: ExecuteWithLoaderContext
  ): Promise<string> {
    // Standard loader names ('laravel', 'symfony') are auto-detected by the phar from the
    // project path — passing them as --loader would cause the phar to eval the string as PHP.
    // Only pass loader when it is a custom base64-encoded PHP class.
    const standardLoaders = ['laravel', 'symfony']
    const loaderArg = standardLoaders.includes(params.loader) ? undefined : params.loader
    return client.execute(params.code, loaderArg, params.projectPath)
  }

  protected timeoutMessage(params: ExecuteWithLoaderParams, timeout: number): string {
    return `PHP code execution with ${params.loader} loader exceeded timeout of ${timeout}ms`
  }

  protected classifyError(err: any, params: ExecuteWithLoaderParams, duration: number): MCPError | null {
    // Framework initialization errors
    if (
      err.message &&
      (err.message.includes('bootstrap') || err.message.includes('autoload') || err.message.includes('vendor'))
    ) {
      return this.errorHandler.createError(
        MCPErrorCode.EXECUTION_ERROR,
        `Failed to initialize ${params.loader} framework`,
        {
          reason: err.message,
          loader: params.loader,
          projectPath: params.projectPath,
          duration,
          troubleshooting: [
            'Verify composer dependencies are installed',
            'Check that vendor/autoload.php exists',
            'Ensure the framework is properly configured',
            'Verify file permissions on the project directory',
          ],
        }
      )
    }

    return null
  }

  protected errorDetailsExtra(params: ExecuteWithLoaderParams): Record<string, unknown> {
    return { loader: params.loader }
  }

  protected historyExtra(params: ExecuteWithLoaderParams): Record<string, unknown> {
    return { loader: params.loader }
  }

  protected resultExtra(params: ExecuteWithLoaderParams, context: ExecuteWithLoaderContext): Record<string, unknown> {
    return { loader: params.loader, frameworkDetected: context.frameworkDetected }
  }

  private detectFramework(loader: string, connection: any): string {
    const settings = getSettings()
    const basePath = connection.path || connection.working_directory || settings.laravelPath || process.cwd()

    // Only do local filesystem checks for local connections; remote paths are not accessible here
    if (connection.type !== 'local') {
      return basePath
    }

    if (loader === 'laravel') {
      const artisanPath = path.join(basePath, 'artisan')
      if (fs.existsSync(artisanPath)) {
        return basePath
      }
    }

    if (loader === 'symfony') {
      const consolePath = path.join(basePath, 'bin', 'console')
      if (fs.existsSync(consolePath)) {
        return basePath
      }
    }

    return basePath
  }

  private validateFrameworkPath(loader: string, projectPath: string, connection: any): boolean {
    // Remote connections (docker, ssh, kubectl, vapor) cannot be validated via local fs
    if (connection.type !== 'local') {
      return true
    }

    try {
      if (loader === 'laravel') {
        const artisanPath = path.join(projectPath, 'artisan')
        const autoloadPath = path.join(projectPath, 'vendor', 'autoload.php')
        return fs.existsSync(artisanPath) && fs.existsSync(autoloadPath)
      }

      if (loader === 'symfony') {
        const consolePath = path.join(projectPath, 'bin', 'console')
        const autoloadPath = path.join(projectPath, 'vendor', 'autoload.php')
        return fs.existsSync(consolePath) && fs.existsSync(autoloadPath)
      }

      return false
    } catch {
      return false
    }
  }
}
