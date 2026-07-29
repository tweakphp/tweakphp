/**
 * Get PHP Info Tool Handler
 * Retrieves PHP environment information from active connection
 */

import { GetPhpInfoParams } from './schemas'
import { MCPErrorCode } from '../types'
import { ConnectionManager } from '../connection-manager'
import { getErrorHandler } from '../error-handler'

interface PhpInfoResult {
  phpVersion: string
  sections: Record<string, any>
  raw?: string
}

export class GetPhpInfoHandler {
  private connectionManager: ConnectionManager
  private errorHandler = getErrorHandler()

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager
  }

  async handle(params: GetPhpInfoParams): Promise<PhpInfoResult> {
    const connection = this.connectionManager.getActiveConnection()

    if (!connection) {
      throw this.errorHandler.createError(
        MCPErrorCode.CONNECTION_ERROR,
        'No active connection available. Please set an active connection first.'
      )
    }

    const client = this.connectionManager.getClient(connection)
    const section = params.section || 'all'

    try {
      // Connect with retry logic
      await this.errorHandler.executeWithRetry(() => client.connect(), 'get_php_info:connect', 2, 1000)

      // Get phpinfo output
      const phpInfoRaw = await client.info()

      // Parse phpinfo into structured format
      const parsed = this.parsePhpInfo(phpInfoRaw)

      // Filter by section if requested
      const filteredSections = this.filterSections(parsed.sections, section)

      return {
        phpVersion: parsed.phpVersion,
        sections: filteredSections,
        raw: section === 'all' ? phpInfoRaw : undefined,
      }
    } catch (error: any) {
      const mcpError = this.errorHandler.createError(
        MCPErrorCode.CONNECTION_ERROR,
        'Failed to retrieve PHP info from active connection',
        {
          connectionType: connection.type,
          connectionName: this.connectionManager.getConnectionName(connection),
          reason: error.message,
        }
      )
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

  private parsePhpInfo(phpInfoRaw: string): { phpVersion: string; sections: Record<string, any> } {
    const sections: Record<string, any> = {
      general: {},
      modules: {},
      environment: {},
      variables: {},
    }

    // Try parsing as JSON first (returned by TweakPHP client phar info command)
    try {
      const trimmed = phpInfoRaw.trim()
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const json = JSON.parse(trimmed)
        if (json && typeof json === 'object') {
          const phpVersion = json.php_version || json.version || 'Unknown'
          sections.general = {
            frameworkName: json.name ?? 'PHP',
            frameworkVersion: json.version ?? '',
            version: phpVersion,
          }
          return { phpVersion, sections }
        }
      }
    } catch {
      // Fallback to text phpinfo parsing
    }

    // Extract PHP version
    const versionMatch = phpInfoRaw.match(/PHP Version => ([\d.]+)/)
    const phpVersion = versionMatch ? versionMatch[1] : 'Unknown'

    // Parse general information
    sections.general = this.parseGeneralSection(phpInfoRaw)

    // Parse loaded modules/extensions
    sections.modules = this.parseModulesSection(phpInfoRaw)

    // Parse environment variables
    sections.environment = this.parseEnvironmentSection(phpInfoRaw)

    // Parse PHP variables
    sections.variables = this.parseVariablesSection(phpInfoRaw)

    return { phpVersion, sections }
  }

  private parseGeneralSection(phpInfo: string): Record<string, any> {
    const general: Record<string, any> = {}

    // Extract key general information
    const patterns = [
      { key: 'version', pattern: /PHP Version => ([\d.]+)/ },
      { key: 'system', pattern: /System => (.+)/ },
      { key: 'buildDate', pattern: /Build Date => (.+)/ },
      { key: 'serverApi', pattern: /Server API => (.+)/ },
      { key: 'virtualDirectorySupport', pattern: /Virtual Directory Support => (.+)/ },
      { key: 'configurationFile', pattern: /Loaded Configuration File => (.+)/ },
      { key: 'scanDir', pattern: /Scan this dir for additional \.ini files => (.+)/ },
      { key: 'phpApi', pattern: /PHP API => (.+)/ },
      { key: 'threadSafety', pattern: /Thread Safety => (.+)/ },
      { key: 'zendVersion', pattern: /Zend Engine v([\d.]+)/ },
    ]

    for (const { key, pattern } of patterns) {
      const match = phpInfo.match(pattern)
      if (match) {
        general[key] = match[1].trim()
      }
    }

    return general
  }

  private parseModulesSection(phpInfo: string): Record<string, any> {
    const modules: Record<string, any> = {
      loaded: [],
      details: {},
    }

    // Extract loaded extensions
    const extensionsMatch = phpInfo.match(/\[PHP Modules\]([\s\S]*?)\[Zend Modules\]/)
    if (extensionsMatch) {
      const extensionsList = extensionsMatch[1]
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('['))

      modules.loaded = extensionsList
    }

    // Parse individual module configurations
    const modulePattern = /^([a-zA-Z0-9_]+)$/gm
    let match
    while ((match = modulePattern.exec(phpInfo)) !== null) {
      const moduleName = match[1]
      if (moduleName && !modules.loaded.includes(moduleName)) {
        modules.loaded.push(moduleName)
      }
    }

    return modules
  }

  private parseEnvironmentSection(phpInfo: string): Record<string, string> {
    const environment: Record<string, string> = {}

    // Extract environment variables section
    const envMatch = phpInfo.match(/Environment([\s\S]*?)(?=\n\n[A-Z]|\n\[|$)/)
    if (envMatch) {
      const envSection = envMatch[1]
      const lines = envSection.split('\n')

      for (const line of lines) {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=>\s*(.+)$/)
        if (match) {
          environment[match[1]] = match[2].trim()
        }
      }
    }

    return environment
  }

  private parseVariablesSection(phpInfo: string): Record<string, any> {
    const variables: Record<string, any> = {}

    // Extract PHP Variables section
    const varsMatch = phpInfo.match(/PHP Variables([\s\S]*?)(?=\n\n[A-Z]|\n\[|$)/)
    if (varsMatch) {
      const varsSection = varsMatch[1]
      const lines = varsSection.split('\n')

      for (const line of lines) {
        const match = line.match(/^(_[A-Z]+\[.+?\])\s*=>\s*(.+)$/)
        if (match) {
          variables[match[1]] = match[2].trim()
        }
      }
    }

    return variables
  }

  private filterSections(sections: Record<string, any>, section: string): Record<string, any> {
    if (section === 'all') {
      return sections
    }

    if (sections[section]) {
      return { [section]: sections[section] }
    }

    throw this.errorHandler.createError(MCPErrorCode.INVALID_PARAMETERS, `Invalid section "${section}"`, {
      validSections: ['general', 'modules', 'environment', 'variables', 'all'],
    })
  }
}
