/**
 * Execute With Loader Tool Handler
 * Executes PHP code with framework context (Laravel/Symfony)
 */

import { ExecuteWithLoaderParams } from './schemas'
import { MCPErrorCode } from '../types'
import { ConnectionManager } from '../connection-manager'
import { ExecutionHistoryDB } from '../execution-history-db'
import { getErrorHandler } from '../error-handler'
import { getSettings } from '../../settings'
import * as fs from 'fs'
import * as path from 'path'

interface ExecuteWithLoaderResult {
  output: unknown
  exitCode: number
  duration: number
  connectionType: string
  connectionName: string
  loader: string
  frameworkDetected?: boolean
}

export class ExecuteWithLoaderHandler {
  private connectionManager: ConnectionManager
  private historyDB: ExecutionHistoryDB
  private errorHandler = getErrorHandler()
  private defaultTimeout = 60000 // 60 seconds for framework bootstrapping

  constructor(connectionManager: ConnectionManager, historyDB: ExecutionHistoryDB) {
    this.connectionManager = connectionManager
    this.historyDB = historyDB
  }

  async handle(params: ExecuteWithLoaderParams): Promise<ExecuteWithLoaderResult> {
    // Validate parameters
    if (!params.code || typeof params.code !== 'string') {
      throw this.errorHandler.createError(
        MCPErrorCode.INVALID_PARAMETERS,
        'Parameter "code" is required and must be a string'
      )
    }

    if (!params.loader || !['laravel', 'symfony'].includes(params.loader)) {
      throw this.errorHandler.createError(
        MCPErrorCode.INVALID_PARAMETERS,
        'Parameter "loader" must be either "laravel" or "symfony"'
      )
    }

    // Determine which connection to use
    let connection = params.connectionId
      ? this.connectionManager.getConnection(params.connectionId)
      : this.connectionManager.getActiveConnection()

    if (!connection) {
      throw this.errorHandler.createError(
        MCPErrorCode.CONNECTION_ERROR,
        'No active connection available. Please specify a connectionId or set an active connection.'
      )
    }

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

    // Get the appropriate client
    const client = this.connectionManager.getClient(connection)
    const timeout = params.timeout || this.defaultTimeout
    const startTime = Date.now()

    try {
      // Connect to the client with retry logic
      await this.errorHandler.executeWithRetry(
        () => client.connect(),
        'execute_with_loader:connect',
        2, // max 2 retries for connection
        1000 // 1 second base delay
      )

      // Execute with loader and timeout.
      // Standard loader names ('laravel', 'symfony') are auto-detected by the phar from the
      // project path — passing them as --loader would cause the phar to eval the string as PHP.
      // Only pass loader when it is a custom base64-encoded PHP class.
      const standardLoaders = ['laravel', 'symfony']
      const loaderArg = standardLoaders.includes(params.loader) ? undefined : params.loader
      const result = await this.executeWithTimeout(
        () => client.execute(params.code, loaderArg, params.projectPath),
        timeout
      )

      const duration = Date.now() - startTime

      // Parse the result
      const trimmed = result.trim()
      const tweakphpResult = trimmed.split('TWEAKPHP_RESULT:')[1]?.trim()
      let output: unknown = trimmed

      if (tweakphpResult) {
        try {
          output = JSON.parse(tweakphpResult)
        } catch {
          output = tweakphpResult
        }
      }

      // Save to execution history
      this.historyDB.insert({
        code: params.code,
        output: typeof output === 'string' ? output : JSON.stringify(output),
        exitCode: 0,
        connectionType: connection.type,
        connectionName: this.connectionManager.getConnectionName(connection),
        duration,
        loader: params.loader,
      })

      return {
        output,
        exitCode: 0,
        duration,
        connectionType: connection.type,
        connectionName: this.connectionManager.getConnectionName(connection),
        loader: params.loader,
        frameworkDetected,
      }
    } catch (err: any) {
      const duration = Date.now() - startTime

      // Save failed execution to history
      this.historyDB.insert({
        code: params.code,
        error: err.message,
        exitCode: 1,
        connectionType: connection.type,
        connectionName: this.connectionManager.getConnectionName(connection),
        duration,
        loader: params.loader,
      })

      // Check if it's a timeout error
      if (err.message === 'TIMEOUT') {
        const timeoutError = this.errorHandler.createError(
          MCPErrorCode.TIMEOUT,
          `PHP code execution with ${params.loader} loader exceeded timeout of ${timeout}ms`,
          { timeout, duration, loader: params.loader, connectionType: connection.type }
        )
        throw this.errorHandler.enhanceErrorWithTroubleshooting(timeoutError)
      }

      // Check if it's a framework initialization error
      if (
        err.message &&
        (err.message.includes('bootstrap') || err.message.includes('autoload') || err.message.includes('vendor'))
      ) {
        throw this.errorHandler.createError(
          MCPErrorCode.EXECUTION_ERROR,
          `Failed to initialize ${params.loader} framework`,
          {
            reason: err.message,
            loader: params.loader,
            projectPath,
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

      // Check if it's a PHP syntax or execution error
      if (err.message && (err.message.includes('Parse error') || err.message.includes('Fatal error'))) {
        const execError = this.errorHandler.createError(MCPErrorCode.EXECUTION_ERROR, 'PHP execution error', {
          phpError: err.message,
          loader: params.loader,
          duration,
          connectionType: connection.type,
        })
        throw this.errorHandler.enhanceErrorWithTroubleshooting(execError)
      }

      // Use error handler to classify and enhance the error
      const mcpError = this.errorHandler.toMCPError(err)
      mcpError.details = {
        ...mcpError.details,
        loader: params.loader,
        duration,
        connectionType: connection.type,
      }
      throw this.errorHandler.enhanceErrorWithTroubleshooting(mcpError, connection.type)
    } finally {
      try {
        await client.disconnect()
      } catch (disconnectErr) {
        // Log disconnect errors but don't throw
        console.error('Failed to disconnect client:', disconnectErr)
      }
    }
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

  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([fn(), new Promise<T>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeout))])
  }
}
