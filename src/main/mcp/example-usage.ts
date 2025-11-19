/**
 * MCP Tool Router Usage Example
 * Demonstrates how to use the tool router and handlers
 */

import { ToolRouter } from './router'
import { MCPToolRequest } from './types'

// Example: Initialize the router
export function initializeRouter(): ToolRouter {
  const router = new ToolRouter()

  // Set an active connection (example with local connection)
  const localConnection = {
    type: 'local',
    php: '/usr/bin/php',
    path: '/var/www/html',
  }

  router.setActiveConnection(localConnection)

  return router
}

// Example: Execute PHP code
export async function exampleExecutePhp(router: ToolRouter) {
  const request: MCPToolRequest = {
    tool: 'execute_php',
    parameters: {
      code: 'echo "Hello from PHP!";',
    },
  }

  const response = await router.route(request)

  if (response.success) {
    console.log('PHP Output:', response.data)
  } else {
    console.error('Error:', response.error)
  }

  return response
}

// Example: Execute with Laravel loader
export async function exampleExecuteWithLoader(router: ToolRouter) {
  const request: MCPToolRequest = {
    tool: 'execute_with_loader',
    parameters: {
      code: 'echo app()->version();',
      loader: 'laravel',
      projectPath: '/var/www/laravel-app',
    },
  }

  const response = await router.route(request)

  if (response.success) {
    console.log('Laravel Output:', response.data)
  } else {
    console.error('Error:', response.error)
  }

  return response
}

// Example: Get execution history
export async function exampleGetHistory(router: ToolRouter) {
  const request: MCPToolRequest = {
    tool: 'get_execution_history',
    parameters: {
      limit: 10,
      offset: 0,
      filter: {
        status: 'success',
      },
    },
  }

  const response = await router.route(request)

  if (response.success) {
    console.log('History Records:', response.data)
  } else {
    console.error('Error:', response.error)
  }

  return response
}

// Example: Switch connection
export async function exampleSwitchConnection(router: ToolRouter) {
  const request: MCPToolRequest = {
    tool: 'switch_connection',
    parameters: {
      connectionType: 'docker',
      connectionConfig: {
        container_name: 'my-php-container',
        working_directory: '/app',
        php_version: '8.2',
        php_path: '/usr/local/bin/php',
      },
    },
  }

  const response = await router.route(request)

  if (response.success) {
    console.log('Connection switched:', response.data)
  } else {
    console.error('Error:', response.error)
  }

  return response
}

// Example: Get PHP info
export async function exampleGetPhpInfo(router: ToolRouter) {
  const request: MCPToolRequest = {
    tool: 'get_php_info',
    parameters: {
      section: 'general',
    },
  }

  const response = await router.route(request)

  if (response.success) {
    console.log('PHP Info:', response.data)
  } else {
    console.error('Error:', response.error)
  }

  return response
}

// Example: List all available tools
export function exampleListTools(router: ToolRouter) {
  const tools = router.getRegisteredTools()
  console.log('Available tools:', tools)
  return tools
}

// Example: Handle invalid parameters
export async function exampleInvalidParameters(router: ToolRouter) {
  const request: MCPToolRequest = {
    tool: 'execute_php',
    parameters: {
      // Missing required 'code' parameter
    },
  }

  const response = await router.route(request)

  if (!response.success) {
    console.log('Expected error:', response.error)
  }

  return response
}

// Example: Handle unknown tool
export async function exampleUnknownTool(router: ToolRouter) {
  const request: MCPToolRequest = {
    tool: 'unknown_tool',
    parameters: {},
  }

  const response = await router.route(request)

  if (!response.success) {
    console.log('Expected error:', response.error)
    console.log('Available tools:', response.error?.details?.availableTools)
  }

  return response
}
