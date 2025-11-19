# MCP Server Integration - Tool Router and Handlers

This directory contains the implementation of the Model Context Protocol (MCP) server tool router and handlers for TweakPHP.

## Overview

The MCP server exposes five core tools that enable AI coding agents to execute PHP code through TweakPHP's existing execution infrastructure:

1. **execute_php** - Execute PHP code through any TweakPHP execution client
2. **execute_with_loader** - Execute PHP code with framework context (Laravel/Symfony)
3. **get_execution_history** - Retrieve execution history from SQLite database
4. **switch_connection** - Switch between different execution environments
5. **get_php_info** - Retrieve PHP environment information

## Architecture

### Components

- **router.ts** - Tool router with parameter validation
- **server.ts** - MCP server lifecycle management
- **types.ts** - TypeScript type definitions
- **tools/** - Individual tool handler implementations
  - **execute-php.ts** - PHP code execution handler
  - **execute-with-loader.ts** - Framework-aware execution handler
  - **get-execution-history.ts** - History retrieval handler
  - **switch-connection.ts** - Connection management handler
  - **get-php-info.ts** - PHP info retrieval handler
  - **schemas.ts** - Parameter type definitions
  - **index.ts** - Tool exports

## Tool Handlers

### 1. Execute PHP (`execute_php`)

Executes PHP code through TweakPHP's execution clients.

**Parameters:**
```typescript
{
  code: string              // Required: PHP code to execute
  connectionId?: string     // Optional: Specific connection ID
  timeout?: number          // Optional: Timeout in milliseconds (default: 30000)
}
```

**Response:**
```typescript
{
  output: string           // PHP execution output
  exitCode: number         // Exit code (0 = success)
  duration: number         // Execution time in milliseconds
  connectionType: string   // Type of connection used
  connectionName: string   // Name of connection
}
```

**Supported Connection Types:**
- local
- docker
- ssh
- kubectl
- vapor

### 2. Execute With Loader (`execute_with_loader`)

Executes PHP code with framework context loaded.

**Parameters:**
```typescript
{
  code: string                    // Required: PHP code to execute
  loader: 'laravel' | 'symfony'   // Required: Framework type
  projectPath?: string            // Optional: Path to framework project
  connectionId?: string           // Optional: Specific connection ID
  timeout?: number                // Optional: Timeout in ms (default: 60000)
}
```

**Response:**
```typescript
{
  output: string              // PHP execution output
  exitCode: number            // Exit code (0 = success)
  duration: number            // Execution time in milliseconds
  connectionType: string      // Type of connection used
  connectionName: string      // Name of connection
  loader: string              // Framework loader used
  frameworkDetected?: boolean // Whether framework was auto-detected
}
```

**Framework Detection:**
- Laravel: Checks for `artisan` file and `vendor/autoload.php`
- Symfony: Checks for `bin/console` and `vendor/autoload.php`

### 3. Get Execution History (`get_execution_history`)

Retrieves execution history from the database.

**Parameters:**
```typescript
{
  limit?: number              // Optional: Max records to return (default: 50)
  offset?: number             // Optional: Pagination offset (default: 0)
  filter?: {
    connectionType?: string   // Filter by connection type
    status?: 'success' | 'error'  // Filter by execution status
    dateFrom?: string         // Filter by start date (ISO 8601)
    dateTo?: string           // Filter by end date (ISO 8601)
  }
}
```

**Response:**
```typescript
{
  records: Array<{
    id: number
    code: string
    output: string
    executedAt: string
    connectionType: string
    connectionName: string
    duration: number
    exitCode: number
    status: 'success' | 'error'
  }>
  total: number               // Total matching records
  limit: number               // Applied limit
  offset: number              // Applied offset
}
```

### 4. Switch Connection (`switch_connection`)

Switches between different execution environments.

**Parameters (Option 1 - Existing Connection):**
```typescript
{
  connectionId: string        // ID of stored connection
}
```

**Parameters (Option 2 - New Connection):**
```typescript
{
  connectionType: 'local' | 'docker' | 'ssh' | 'kubectl' | 'vapor'
  connectionConfig: {
    // Connection-specific configuration
    // See connection type requirements below
  }
}
```

**Connection Type Requirements:**

**Local:**
```typescript
{
  php: string                 // Path to PHP executable
  path?: string               // Working directory
}
```

**Docker:**
```typescript
{
  container_id?: string       // Container ID
  container_name?: string     // Container name
  working_directory?: string  // Working directory in container
}
```

**SSH:**
```typescript
{
  host: string                // SSH host
  username: string            // SSH username
  port?: number               // SSH port (default: 22)
  password?: string           // Password authentication
  privateKey?: string         // Private key authentication
  passphrase?: string         // Private key passphrase
}
```

**Response:**
```typescript
{
  success: boolean
  connectionType: string
  connectionName: string
  phpVersion?: string         // PHP version if available
  details: Record<string, any>  // Connection details (sanitized)
}
```

### 5. Get PHP Info (`get_php_info`)

Retrieves PHP environment information.

**Parameters:**
```typescript
{
  section?: 'general' | 'modules' | 'environment' | 'variables' | 'all'
  // Default: 'all'
}
```

**Response:**
```typescript
{
  phpVersion: string
  sections: {
    general?: {
      version: string
      system: string
      buildDate: string
      serverApi: string
      configurationFile: string
      // ... more general info
    }
    modules?: {
      loaded: string[]        // List of loaded extensions
      details: Record<string, any>
    }
    environment?: Record<string, string>  // Environment variables
    variables?: Record<string, any>       // PHP variables
  }
  raw?: string                // Raw phpinfo output (only if section='all')
}
```

## Error Handling

All tools return structured error responses:

```typescript
{
  success: false
  error: {
    code: string              // Error code (see MCPErrorCode enum)
    message: string           // Human-readable error message
    details?: Record<string, unknown>  // Additional error context
  }
}
```

**Error Codes:**
- `INVALID_PARAMETERS` - Invalid or missing parameters
- `EXECUTION_ERROR` - PHP execution error
- `TIMEOUT` - Execution timeout
- `CONNECTION_ERROR` - Connection failure
- `NOT_FOUND` - Resource not found
- `INTERNAL_ERROR` - Internal server error

## Usage Example

```typescript
import { ToolRouter } from './router'

// Initialize router
const router = new ToolRouter()

// Set active connection
router.setActiveConnection({
  type: 'local',
  php: '/usr/bin/php',
  path: '/var/www/html'
})

// Execute PHP code
const response = await router.route({
  tool: 'execute_php',
  parameters: {
    code: 'echo "Hello, World!";'
  }
})

if (response.success) {
  console.log('Output:', response.data)
} else {
  console.error('Error:', response.error)
}
```

See `example-usage.ts` for more comprehensive examples.

## Implementation Notes

### Parameter Validation

All tool parameters are validated before execution:
- Type checking (string, number, object)
- Required field validation
- Enum value validation (loader types, connection types, sections)
- Range validation (limits, offsets)

### Connection Management

The router maintains:
- **Active Connection**: The currently selected execution environment
- **Stored Connections**: Map of connection IDs to connection configs

All handlers that need connection access share the same active connection through the router.

### Timeout Handling

- Default timeout for `execute_php`: 30 seconds
- Default timeout for `execute_with_loader`: 60 seconds (framework bootstrapping takes longer)
- Timeouts are configurable per request
- Timeout errors include duration information for debugging

### Framework Detection

When `projectPath` is not provided to `execute_with_loader`:
1. Uses connection's working directory as base path
2. Checks for framework-specific files:
   - Laravel: `artisan` file
   - Symfony: `bin/console` file
3. Falls back to connection path if detection fails

### Security Considerations

- Connection details are sanitized before returning (passwords, keys removed)
- All code execution goes through existing TweakPHP client infrastructure
- No direct shell access - all execution is sandboxed by clients
- Localhost-only binding (implemented in server.ts)

## Requirements Mapping

This implementation satisfies the following requirements from the design document:

- **Requirement 1.1**: Execute PHP across all client types ✓
- **Requirement 1.2**: Structured error responses for invalid syntax ✓
- **Requirement 1.3**: Default connection usage ✓
- **Requirement 1.4**: Timeout handling ✓
- **Requirement 1.5**: Support for all execution clients ✓
- **Requirement 2.1**: Framework loader bootstrapping ✓
- **Requirement 2.2**: Laravel loader support ✓
- **Requirement 2.3**: Symfony loader support ✓
- **Requirement 2.4**: Framework initialization error handling ✓
- **Requirement 2.5**: Framework auto-detection ✓
- **Requirement 3.1**: Execution history retrieval ✓
- **Requirement 3.2**: History pagination ✓
- **Requirement 3.3**: History filtering ✓
- **Requirement 3.4**: Complete execution record data ✓
- **Requirement 4.1**: Connection switching by ID ✓
- **Requirement 4.2**: New connection establishment ✓
- **Requirement 4.3**: Invalid connection error handling ✓
- **Requirement 4.4**: Connection switch confirmation ✓
- **Requirement 4.5**: Connection failure preservation ✓
- **Requirement 5.1**: PHP info retrieval ✓
- **Requirement 5.2**: Structured PHP info data ✓
- **Requirement 5.3**: Section filtering ✓
- **Requirement 5.5**: JSON format output ✓
- **Requirement 7.1**: Structured error responses ✓
- **Requirement 7.2**: Error type distinction ✓
- **Requirement 7.3**: PHP error details ✓
- **Requirement 7.4**: Connection error details ✓

## Integration with TweakPHP Components

### Connection Manager

The `ConnectionManager` class provides centralized connection management:

```typescript
import { ConnectionManager } from './connection-manager'

const connectionManager = new ConnectionManager()

// Get active connection
const active = connectionManager.getActiveConnection()

// Add a new connection
connectionManager.addConnection('my-docker', {
  type: 'docker',
  name: 'My Docker Container',
  container_name: 'my-php-container'
})

// Switch to a connection
const connection = connectionManager.getConnection('my-docker')
connectionManager.setActiveConnection(connection)

// Get a client for execution
const client = connectionManager.getClient(connection)
```

**Features:**
- Automatic initialization with default local connection from settings
- Connection storage and retrieval by ID
- Client factory for all connection types
- Connection name resolution
- Connection ID generation

### Execution History Database

The `ExecutionHistoryDB` class manages execution history in SQLite:

```typescript
import { ExecutionHistoryDB } from './execution-history-db'

const historyDB = new ExecutionHistoryDB()

// Insert execution record
const id = historyDB.insert({
  code: 'echo "test";',
  output: 'test',
  exitCode: 0,
  connectionType: 'local',
  connectionName: 'Local',
  duration: 150
})

// Query with filters
const { records, total } = historyDB.query({
  limit: 10,
  offset: 0,
  connectionType: 'local',
  status: 'success'
})

// Get statistics
const stats = historyDB.getStats()
```

**Features:**
- Automatic record insertion on execution
- Flexible querying with filters and pagination
- Statistics aggregation
- Cleanup utilities for old records

### Database Migration

A new migration file has been created at `migrations/002_create_execution_history_table.sql`:

```sql
CREATE TABLE IF NOT EXISTS execution_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    output TEXT,
    error TEXT,
    exit_code INTEGER NOT NULL DEFAULT 0,
    connection_type TEXT NOT NULL,
    connection_name TEXT NOT NULL,
    duration INTEGER NOT NULL,
    loader TEXT,
    created_at TEXT NOT NULL
);
```

The migration will run automatically on application startup.

## Documentation

Complete documentation is available:

- **[API.md](./API.md)** - Complete API reference for all five tools
- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Setup guide for AI agents (Claude Desktop, Cursor, etc.)
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Comprehensive troubleshooting guide
- **[CONFIGURATION.md](./CONFIGURATION.md)** - Configuration and persistence details
- **[ERROR_HANDLING.md](./ERROR_HANDLING.md)** - Error handling system documentation

## Quick Links

- **Getting Started**: See [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- **Tool Reference**: See [API.md](./API.md)
- **Having Issues?**: See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

## Testing

The implementation includes:
- Comprehensive parameter validation
- Detailed error handling with structured responses
- Type safety through TypeScript
- Automatic error logging and recovery
- Example usage demonstrations in `example-usage.ts`

Manual testing can be performed using the examples in `example-usage.ts`.
