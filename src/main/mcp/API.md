# MCP Server API Documentation

## Overview

The TweakPHP MCP Server exposes five tools that enable AI coding agents to execute PHP code through TweakPHP's execution infrastructure. This document provides complete API reference for all tools, including parameters, responses, and error handling.

## Base URL

The MCP server runs on localhost only:
- **Default**: `http://127.0.0.1:3000`
- **Configurable**: Port can be changed in TweakPHP settings

## Authentication

Currently, the MCP server does not require authentication. It binds to localhost only for security.

## Tools

### 1. execute_php

Execute PHP code through any TweakPHP execution client (local, Docker, SSH, kubectl, Vapor).

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | string | Yes | - | PHP code to execute |
| `connectionId` | string | No | Active connection | ID of stored connection to use |
| `timeout` | number | No | 30000 | Timeout in milliseconds |

#### Request Example

```json
{
  "tool": "execute_php",
  "parameters": {
    "code": "<?php echo 'Hello, World!';",
    "timeout": 10000
  }
}
```

#### Response

```typescript
{
  "success": true,
  "data": {
    "output": "Hello, World!",
    "exitCode": 0,
    "duration": 150,
    "connectionType": "local",
    "connectionName": "Local PHP 8.3"
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `output` | string | PHP execution output |
| `exitCode` | number | Exit code (0 = success, 1 = error) |
| `duration` | number | Execution time in milliseconds |
| `connectionType` | string | Type of connection used (local, docker, ssh, kubectl, vapor) |
| `connectionName` | string | Human-readable connection name |

#### Error Responses

**Invalid Parameters**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Parameter \"code\" is required and must be a string"
  }
}
```

**PHP Syntax Error**
```json
{
  "success": false,
  "error": {
    "code": "EXECUTION_ERROR",
    "message": "PHP execution error",
    "details": {
      "phpError": "Parse error: syntax error, unexpected ';' in Command line code on line 1",
      "duration": 120,
      "connectionType": "local"
    }
  }
}
```

**Timeout Error**
```json
{
  "success": false,
  "error": {
    "code": "TIMEOUT",
    "message": "PHP code execution exceeded timeout of 30000ms",
    "details": {
      "timeout": 30000,
      "duration": 30001,
      "connectionType": "local"
    }
  }
}
```

---

### 2. execute_with_loader

Execute PHP code with framework context loaded (Laravel or Symfony).

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `code` | string | Yes | - | PHP code to execute |
| `loader` | string | Yes | - | Framework type: "laravel" or "symfony" |
| `projectPath` | string | No | Auto-detect | Path to framework project |
| `connectionId` | string | No | Active connection | ID of stored connection to use |
| `timeout` | number | No | 60000 | Timeout in milliseconds |

#### Request Example

```json
{
  "tool": "execute_with_loader",
  "parameters": {
    "code": "<?php echo app()->version();",
    "loader": "laravel",
    "projectPath": "/var/www/my-laravel-app"
  }
}
```

#### Response

```typescript
{
  "success": true,
  "data": {
    "output": "10.x-dev",
    "exitCode": 0,
    "duration": 850,
    "connectionType": "local",
    "connectionName": "Local PHP 8.3",
    "loader": "laravel",
    "frameworkDetected": false
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `output` | string | PHP execution output |
| `exitCode` | number | Exit code (0 = success, 1 = error) |
| `duration` | number | Execution time in milliseconds |
| `connectionType` | string | Type of connection used |
| `connectionName` | string | Human-readable connection name |
| `loader` | string | Framework loader used |
| `frameworkDetected` | boolean | Whether framework was auto-detected |

#### Framework Detection

When `projectPath` is not provided, the tool attempts to auto-detect the framework:

**Laravel Detection:**
- Checks for `artisan` file in connection's working directory
- Verifies `vendor/autoload.php` exists

**Symfony Detection:**
- Checks for `bin/console` file in connection's working directory
- Verifies `vendor/autoload.php` exists

#### Error Responses

**Invalid Loader**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Parameter \"loader\" must be either \"laravel\" or \"symfony\""
  }
}
```

**Framework Not Found**
```json
{
  "success": false,
  "error": {
    "code": "EXECUTION_ERROR",
    "message": "Failed to initialize laravel framework",
    "details": {
      "reason": "Framework files not found at specified path",
      "projectPath": "/var/www/my-app",
      "loader": "laravel",
      "troubleshooting": [
        "Verify the project path is correct",
        "Ensure composer dependencies are installed (run: composer install)",
        "Check that artisan file exists",
        "Verify vendor/autoload.php is present"
      ]
    }
  }
}
```

---

### 3. get_execution_history

Retrieve execution history from TweakPHP's SQLite database.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | 50 | Maximum records to return (1-1000) |
| `offset` | number | No | 0 | Pagination offset |
| `filter` | object | No | - | Filter criteria |
| `filter.connectionType` | string | No | - | Filter by connection type |
| `filter.status` | string | No | - | Filter by status: "success" or "error" |
| `filter.dateFrom` | string | No | - | Filter by start date (ISO 8601) |
| `filter.dateTo` | string | No | - | Filter by end date (ISO 8601) |

#### Request Example

```json
{
  "tool": "get_execution_history",
  "parameters": {
    "limit": 10,
    "offset": 0,
    "filter": {
      "connectionType": "local",
      "status": "success"
    }
  }
}
```

#### Response

```typescript
{
  "success": true,
  "data": {
    "records": [
      {
        "id": 42,
        "code": "<?php echo 'test';",
        "output": "test",
        "executedAt": "2024-01-15T10:30:00.000Z",
        "connectionType": "local",
        "connectionName": "Local PHP 8.3",
        "duration": 120,
        "exitCode": 0,
        "status": "success"
      }
    ],
    "total": 150,
    "limit": 10,
    "offset": 0
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `records` | array | Array of execution records |
| `records[].id` | number | Unique record ID |
| `records[].code` | string | PHP code that was executed |
| `records[].output` | string | Execution output |
| `records[].executedAt` | string | ISO 8601 timestamp |
| `records[].connectionType` | string | Connection type used |
| `records[].connectionName` | string | Connection name |
| `records[].duration` | number | Execution time in milliseconds |
| `records[].exitCode` | number | Exit code (0 = success) |
| `records[].status` | string | "success" or "error" |
| `total` | number | Total matching records in database |
| `limit` | number | Applied limit |
| `offset` | number | Applied offset |

#### Error Responses

**Invalid Limit**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Parameter \"limit\" must be between 1 and 1000"
  }
}
```

---

### 4. switch_connection

Switch between different execution environments or create new connections.

#### Parameters (Option 1: Existing Connection)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `connectionId` | string | Yes | ID of stored connection |

#### Parameters (Option 2: New Connection)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `connectionType` | string | Yes | Connection type: "local", "docker", "ssh", "kubectl", "vapor" |
| `connectionConfig` | object | Yes | Connection-specific configuration |

#### Connection Type Configurations

**Local Connection**
```json
{
  "connectionType": "local",
  "connectionConfig": {
    "php": "/usr/bin/php",
    "path": "/var/www/html"
  }
}
```

**Docker Connection**
```json
{
  "connectionType": "docker",
  "connectionConfig": {
    "container_name": "my-php-container",
    "working_directory": "/var/www/html"
  }
}
```

**SSH Connection**
```json
{
  "connectionType": "ssh",
  "connectionConfig": {
    "host": "example.com",
    "username": "deploy",
    "port": 22,
    "password": "secret"
  }
}
```

**Kubectl Connection**
```json
{
  "connectionType": "kubectl",
  "connectionConfig": {
    "pod_name": "my-php-pod",
    "namespace": "production",
    "container": "php"
  }
}
```

**Vapor Connection**
```json
{
  "connectionType": "vapor",
  "connectionConfig": {
    "environment": "production",
    "project_id": "12345"
  }
}
```

#### Request Example

```json
{
  "tool": "switch_connection",
  "parameters": {
    "connectionType": "docker",
    "connectionConfig": {
      "container_name": "my-php-container"
    }
  }
}
```

#### Response

```typescript
{
  "success": true,
  "data": {
    "success": true,
    "connectionType": "docker",
    "connectionName": "Docker: my-php-container",
    "phpVersion": "8.3.0",
    "details": {
      "type": "docker",
      "container_name": "my-php-container"
    }
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether connection switch succeeded |
| `connectionType` | string | Type of connection |
| `connectionName` | string | Human-readable connection name |
| `phpVersion` | string | PHP version (if available) |
| `details` | object | Sanitized connection details (passwords removed) |

#### Error Responses

**Connection Not Found**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Connection with ID \"my-connection\" not found",
    "details": {
      "connectionId": "my-connection",
      "availableConnections": ["local-1", "docker-1", "ssh-1"]
    }
  }
}
```

**Connection Failed**
```json
{
  "success": false,
  "error": {
    "code": "CONNECTION_ERROR",
    "message": "Failed to connect to \"docker-1\"",
    "details": {
      "connectionId": "docker-1",
      "reason": "Container not found"
    }
  }
}
```

---

### 5. get_php_info

Retrieve PHP environment information from the active connection.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `section` | string | No | "all" | Section to retrieve: "general", "modules", "environment", "variables", "all" |

#### Request Example

```json
{
  "tool": "get_php_info",
  "parameters": {
    "section": "general"
  }
}
```

#### Response

```typescript
{
  "success": true,
  "data": {
    "phpVersion": "8.3.0",
    "sections": {
      "general": {
        "version": "8.3.0",
        "system": "Darwin",
        "buildDate": "Dec 6 2023 15:31:23",
        "serverApi": "CLI",
        "configurationFile": "/usr/local/etc/php/8.3/php.ini",
        "phpApi": "20230831",
        "threadSafety": "disabled",
        "zendVersion": "4.3.0"
      }
    }
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `phpVersion` | string | PHP version |
| `sections` | object | Requested sections |
| `sections.general` | object | General PHP information |
| `sections.modules` | object | Loaded extensions and modules |
| `sections.environment` | object | Environment variables |
| `sections.variables` | object | PHP variables |
| `raw` | string | Raw phpinfo output (only when section="all") |

#### Section Details

**General Section**
```json
{
  "version": "8.3.0",
  "system": "Darwin",
  "buildDate": "Dec 6 2023 15:31:23",
  "serverApi": "CLI",
  "configurationFile": "/usr/local/etc/php/8.3/php.ini",
  "phpApi": "20230831",
  "threadSafety": "disabled",
  "zendVersion": "4.3.0"
}
```

**Modules Section**
```json
{
  "loaded": ["Core", "date", "libxml", "openssl", "pcre", "zlib", "filter", "hash", "json", "PDO", "pdo_mysql"],
  "details": {}
}
```

**Environment Section**
```json
{
  "PATH": "/usr/local/bin:/usr/bin:/bin",
  "HOME": "/Users/username",
  "USER": "username"
}
```

**Variables Section**
```json
{
  "_SERVER['PHP_SELF']": "Standard input code",
  "_SERVER['SCRIPT_NAME']": "Standard input code"
}
```

#### Error Responses

**No Active Connection**
```json
{
  "success": false,
  "error": {
    "code": "CONNECTION_ERROR",
    "message": "No active connection available. Please set an active connection first."
  }
}
```

**Invalid Section**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Invalid section \"invalid\"",
    "details": {
      "validSections": ["general", "modules", "environment", "variables", "all"]
    }
  }
}
```

---

## Error Codes

All errors follow a consistent structure:

```typescript
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      // Additional context
    }
  }
}
```

### Error Code Reference

| Code | Description | Retryable |
|------|-------------|-----------|
| `INVALID_PARAMETERS` | Invalid or missing parameters | No |
| `EXECUTION_ERROR` | PHP execution or syntax error | No |
| `TIMEOUT` | Operation exceeded timeout | Yes |
| `CONNECTION_ERROR` | Connection failed or unavailable | Yes |
| `NOT_FOUND` | Resource not found | No |
| `INTERNAL_ERROR` | Unexpected internal error | Yes |
| `AUTHENTICATION_FAILED` | Authentication error | No |

### Retry Strategy

For retryable errors, use exponential backoff:

```
Attempt 1: Immediate
Attempt 2: Wait 1 second
Attempt 3: Wait 2 seconds
Attempt 4: Wait 4 seconds
```

Maximum recommended retries: 3

---

## Rate Limiting

The MCP server supports up to 5 concurrent executions by default. Additional requests will queue until a slot becomes available.

---

## Logging

All tool invocations and errors are logged to:
- **Location**: `{userData}/logs/mcp-server.log`
- **Format**: JSON
- **Rotation**: 10MB max size, 5 rotations
- **Sensitive Data**: Automatically sanitized (passwords, keys, tokens)

---

## Best Practices

### 1. Always Handle Errors

```typescript
try {
  const result = await mcpClient.invoke('execute_php', { code: '<?php echo "test";' })
  console.log(result.data.output)
} catch (error) {
  if (error.code === 'TIMEOUT') {
    // Retry with longer timeout
  } else if (error.code === 'EXECUTION_ERROR') {
    // Handle PHP error
  }
}
```

### 2. Use Appropriate Timeouts

- Simple code: 10-30 seconds
- Framework code: 30-60 seconds
- Complex operations: 60-120 seconds

### 3. Leverage Execution History

Query history to avoid re-executing identical code:

```typescript
const history = await mcpClient.invoke('get_execution_history', {
  limit: 1,
  filter: { status: 'success' }
})
```

### 4. Test Connections Before Use

Always test a connection after switching:

```typescript
await mcpClient.invoke('switch_connection', { connectionId: 'my-connection' })
const info = await mcpClient.invoke('get_php_info', { section: 'general' })
console.log('Connected to PHP', info.data.phpVersion)
```

### 5. Use Framework Loaders When Appropriate

For Laravel/Symfony code, always use `execute_with_loader`:

```typescript
// Good
await mcpClient.invoke('execute_with_loader', {
  code: '<?php echo app()->version();',
  loader: 'laravel'
})

// Bad - won't work
await mcpClient.invoke('execute_php', {
  code: '<?php echo app()->version();'
})
```

---

## Version History

- **v1.0.0** (2024-01-15): Initial release
  - Five core tools
  - Support for all TweakPHP execution clients
  - Execution history tracking
  - Comprehensive error handling
