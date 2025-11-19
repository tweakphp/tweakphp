# MCP Error Handling System

## Overview

The MCP server implements a comprehensive error handling system with structured error responses, centralized logging, and automatic recovery strategies.

## Components

### 1. Error Logger (`error-logger.ts`)

Centralized logging system that writes to `{userData}/logs/mcp-server.log`.

**Features:**
- Automatic log rotation (10MB max size, 5 rotations)
- Sensitive data sanitization (passwords, keys, tokens)
- JSON-formatted log entries
- Support for error, info, and warning levels

**Usage:**
```typescript
import { getErrorLogger } from './error-logger'

const logger = getErrorLogger()
logger.logError(mcpError, 'tool_name', stackTrace)
logger.logInfo('Server started', { port: 3000 })
logger.logWarning('Connection slow', { latency: 5000 })
```

### 2. Error Handler (`error-handler.ts`)

Provides error classification, recovery strategies, and retry logic.

**Features:**
- Automatic error classification (timeout, connection, execution, etc.)
- PHP error detail extraction (file, line, error type)
- Retry logic with exponential backoff
- Timeout enforcement
- Troubleshooting tips generation

**Usage:**
```typescript
import { getErrorHandler } from './error-handler'

const handler = getErrorHandler()

// Simple error handling
try {
  // operation
} catch (error) {
  throw handler.handleError(error, 'tool_name')
}

// With retry logic
const result = await handler.executeWithRetry(
  () => client.connect(),
  'tool_name',
  3, // max retries
  1000 // base delay ms
)

// With timeout
const result = await handler.executeWithTimeout(
  () => operation(),
  30000, // timeout ms
  'tool_name'
)
```

### 3. Error Response Structure

All errors follow a consistent format:

```typescript
{
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: 'Human-readable message',
    details: {
      // Context-specific information
      // Troubleshooting tips (when applicable)
    }
  }
}
```

## Error Codes

- `INVALID_PARAMETERS` - Invalid or missing parameters
- `EXECUTION_ERROR` - PHP execution or syntax errors
- `TIMEOUT` - Operation exceeded timeout
- `CONNECTION_ERROR` - Connection failed or unavailable
- `NOT_FOUND` - Resource not found
- `INTERNAL_ERROR` - Unexpected internal errors
- `AUTHENTICATION_FAILED` - Authentication errors

## Recovery Strategies

The error handler automatically determines retry strategies:

| Error Type | Retryable | Max Retries | Base Delay |
|------------|-----------|-------------|------------|
| Timeout | Yes | 2 | 1000ms |
| Connection | Yes | 3 | 2000ms |
| Internal | Yes | 1 | 500ms |
| Execution | No | - | - |
| Invalid Params | No | - | - |
| Not Found | No | - | - |

## Integration

All tool handlers use the error handling system:

```typescript
export class MyToolHandler {
  private errorHandler = getErrorHandler()
  
  async handle(params: MyParams): Promise<MyResult> {
    // Validate
    if (!params.required) {
      throw this.errorHandler.createError(
        MCPErrorCode.INVALID_PARAMETERS,
        'Missing required parameter'
      )
    }
    
    try {
      // Connect with retry
      await this.errorHandler.executeWithRetry(
        () => client.connect(),
        'my_tool:connect',
        2,
        1000
      )
      
      // Execute operation
      const result = await operation()
      return result
      
    } catch (error) {
      // Enhance and throw
      const mcpError = this.errorHandler.toMCPError(error)
      throw this.errorHandler.enhanceErrorWithTroubleshooting(
        mcpError,
        connectionType
      )
    }
  }
}
```

## Logging

All errors are automatically logged by the router. Tool handlers can also log directly:

```typescript
const logger = getErrorLogger()

// Log successful operations
logger.logInfo('Tool executed successfully', { tool: 'execute_php' })

// Log warnings
logger.logWarning('Slow operation detected', { duration: 5000 })

// Errors are logged automatically by the error handler
```

## Troubleshooting Tips

The error handler automatically adds troubleshooting tips based on error type and connection type:

- **Connection errors**: Include connection-specific tips (Docker, SSH, kubectl, etc.)
- **Execution errors**: Include PHP debugging tips
- **Timeout errors**: Include performance optimization tips
- **Framework errors**: Include framework-specific tips

## Best Practices

1. **Always use error handler**: Don't create raw MCPError objects
2. **Add context**: Include relevant details in error context
3. **Use retry logic**: For transient errors (connections, timeouts)
4. **Clean up resources**: Use try/finally for disconnect operations
5. **Don't expose sensitive data**: Logger automatically sanitizes, but be careful
6. **Enhance errors**: Use `enhanceErrorWithTroubleshooting()` for user-facing errors
