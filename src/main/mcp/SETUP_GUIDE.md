# MCP Server Setup Guide for AI Agents

## Overview

This guide walks you through setting up and connecting to the TweakPHP MCP Server from AI coding agents like Claude Desktop, Cursor, or custom MCP clients.

## Prerequisites

- TweakPHP application installed and running
- AI agent with MCP support (Claude Desktop, Cursor, etc.)
- Basic understanding of JSON configuration

## Quick Start

### 1. Enable MCP Server in TweakPHP

1. Open TweakPHP application
2. Navigate to **Settings** (gear icon in sidebar)
3. Click on **MCP Server** tab
4. Toggle **Enable MCP Server** to ON
5. Note the port number (default: 3000)
6. Click **Save Settings**

The server will start automatically and bind to `127.0.0.1` (localhost only).

### 2. Configure Your AI Agent

#### Claude Desktop

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tweakphp": {
      "command": "node",
      "args": ["-e", "require('http').request({host:'127.0.0.1',port:3000,method:'POST',path:'/mcp'},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log(d))}).end(JSON.stringify(process.argv[2]))"],
      "env": {}
    }
  }
}
```

#### Cursor

Add to your Cursor MCP configuration:

```json
{
  "mcp": {
    "servers": {
      "tweakphp": {
        "url": "http://127.0.0.1:3000",
        "type": "http"
      }
    }
  }
}
```

#### Custom MCP Client

Use the MCP SDK to connect:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const client = new Client({
  name: 'my-agent',
  version: '1.0.0'
})

await client.connect(new StdioClientTransport({
  command: 'node',
  args: ['-e', 'require("http").request({host:"127.0.0.1",port:3000,method:"POST",path:"/mcp"},r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>console.log(d))}).end(JSON.stringify(process.argv[2]))']
}))
```

### 3. Verify Connection

Test the connection by invoking a simple tool:

```typescript
const result = await client.callTool('execute_php', {
  code: '<?php echo "Hello from TweakPHP!";'
})

console.log(result.data.output) // "Hello from TweakPHP!"
```

## Configuration Options

### Server Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Enabled | false | Whether MCP server is running |
| Port | 3000 | Port number (1024-65535) |
| Host | 127.0.0.1 | Always localhost (not configurable) |
| Timeout | 30000 | Default timeout in milliseconds |
| Max Concurrent | 5 | Maximum concurrent executions |

### Changing the Port

If port 3000 is already in use:

1. Open TweakPHP Settings → MCP Server
2. Change **Port** to an available port (e.g., 3001)
3. Click **Save Settings**
4. Update your AI agent configuration with the new port
5. Restart your AI agent

## Setting Up Connections

The MCP server uses TweakPHP's connection system. You need to set up at least one connection before executing PHP code.

### Local Connection (Recommended for Getting Started)

TweakPHP automatically creates a local connection using your system's PHP installation.

**Verify Local PHP:**
```bash
which php
php --version
```

**Test Local Connection:**
```typescript
const info = await client.callTool('get_php_info', {
  section: 'general'
})
console.log('PHP Version:', info.data.phpVersion)
```

### Docker Connection

**Prerequisites:**
- Docker installed and running
- PHP container running

**Setup:**
```typescript
await client.callTool('switch_connection', {
  connectionType: 'docker',
  connectionConfig: {
    container_name: 'my-php-container',
    working_directory: '/var/www/html'
  }
})
```

**Verify:**
```bash
docker ps | grep my-php-container
```

### SSH Connection

**Prerequisites:**
- SSH access to remote server
- PHP installed on remote server

**Setup:**
```typescript
await client.callTool('switch_connection', {
  connectionType: 'ssh',
  connectionConfig: {
    host: 'example.com',
    username: 'deploy',
    port: 22,
    password: 'your-password'
    // OR use private key:
    // privateKey: '/path/to/key',
    // passphrase: 'key-passphrase'
  }
})
```

### Kubernetes Connection

**Prerequisites:**
- kubectl configured and authenticated
- PHP pod running in cluster

**Setup:**
```typescript
await client.callTool('switch_connection', {
  connectionType: 'kubectl',
  connectionConfig: {
    pod_name: 'my-php-pod',
    namespace: 'production',
    container: 'php'
  }
})
```

**Verify:**
```bash
kubectl get pods -n production | grep my-php-pod
```

### Laravel Vapor Connection

**Prerequisites:**
- Laravel Vapor account
- Vapor CLI installed and authenticated

**Setup:**
```typescript
await client.callTool('switch_connection', {
  connectionType: 'vapor',
  connectionConfig: {
    environment: 'production',
    project_id: '12345'
  }
})
```

## Common Workflows

### Workflow 1: Execute Simple PHP Code

```typescript
// Execute PHP code
const result = await client.callTool('execute_php', {
  code: '<?php echo json_encode(["status" => "ok"]);'
})

console.log(result.data.output) // {"status":"ok"}
```

### Workflow 2: Test Laravel Application

```typescript
// Switch to Laravel project
await client.callTool('switch_connection', {
  connectionType: 'local',
  connectionConfig: {
    php: '/usr/bin/php',
    path: '/var/www/my-laravel-app'
  }
})

// Execute with Laravel context
const result = await client.callTool('execute_with_loader', {
  code: '<?php echo app()->version();',
  loader: 'laravel'
})

console.log('Laravel Version:', result.data.output)
```

### Workflow 3: Debug Remote Server

```typescript
// Connect to remote server
await client.callTool('switch_connection', {
  connectionType: 'ssh',
  connectionConfig: {
    host: 'production.example.com',
    username: 'deploy',
    privateKey: '/path/to/key'
  }
})

// Check PHP configuration
const info = await client.callTool('get_php_info', {
  section: 'modules'
})

console.log('Loaded Extensions:', info.data.sections.modules.loaded)

// Execute diagnostic code
const result = await client.callTool('execute_php', {
  code: '<?php echo disk_free_space("/");'
})

console.log('Free Disk Space:', result.data.output)
```

### Workflow 4: Review Execution History

```typescript
// Get recent executions
const history = await client.callTool('get_execution_history', {
  limit: 10,
  filter: {
    status: 'error'
  }
})

// Analyze errors
for (const record of history.data.records) {
  console.log(`Error at ${record.executedAt}:`)
  console.log(record.output)
}
```

## Security Best Practices

### 1. Localhost Only

The MCP server **always** binds to `127.0.0.1` and is not accessible from the network. This is enforced and cannot be changed.

### 2. Sensitive Data

- Passwords and private keys are sanitized from logs
- Connection details are sanitized in responses
- Never log or expose credentials in PHP code

### 3. Code Execution

- All code execution goes through TweakPHP's existing client infrastructure
- No direct shell access
- Execution is sandboxed by the underlying client (Docker, SSH, etc.)

### 4. Timeouts

Always set appropriate timeouts to prevent runaway executions:

```typescript
const result = await client.callTool('execute_php', {
  code: '<?php /* potentially slow code */',
  timeout: 10000 // 10 seconds
})
```

## Performance Tips

### 1. Reuse Connections

Switching connections has overhead. Reuse the same connection for multiple executions:

```typescript
// Good: Switch once, execute many times
await client.callTool('switch_connection', { connectionId: 'my-docker' })
await client.callTool('execute_php', { code: '<?php echo "test1";' })
await client.callTool('execute_php', { code: '<?php echo "test2";' })

// Bad: Switching for every execution
await client.callTool('switch_connection', { connectionId: 'my-docker' })
await client.callTool('execute_php', { code: '<?php echo "test1";' })
await client.callTool('switch_connection', { connectionId: 'my-docker' })
await client.callTool('execute_php', { code: '<?php echo "test2";' })
```

### 2. Use Appropriate Timeouts

- Simple code: 10-30 seconds
- Framework bootstrapping: 30-60 seconds
- Complex operations: 60-120 seconds

### 3. Leverage Execution History

Check history before re-executing identical code:

```typescript
const history = await client.callTool('get_execution_history', {
  limit: 1,
  filter: { status: 'success' }
})

if (history.data.records[0]?.code === myCode) {
  console.log('Using cached result:', history.data.records[0].output)
} else {
  const result = await client.callTool('execute_php', { code: myCode })
}
```

### 4. Concurrent Executions

The server supports up to 5 concurrent executions. Additional requests will queue.

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed troubleshooting steps.

### Quick Checks

**Server Not Running:**
```typescript
// Check server status in TweakPHP Settings → MCP Server
// Verify "Status: Running" is displayed
```

**Connection Failed:**
```typescript
// Verify connection details
const info = await client.callTool('get_php_info', { section: 'general' })
```

**Timeout Errors:**
```typescript
// Increase timeout
const result = await client.callTool('execute_php', {
  code: myCode,
  timeout: 60000 // 60 seconds
})
```

## Examples

### Example 1: Laravel Artisan Commands

```typescript
await client.callTool('execute_with_loader', {
  code: `<?php
    Artisan::call('route:list');
    echo Artisan::output();
  `,
  loader: 'laravel'
})
```

### Example 2: Database Query

```typescript
await client.callTool('execute_with_loader', {
  code: `<?php
    $users = DB::table('users')->count();
    echo "Total users: $users";
  `,
  loader: 'laravel'
})
```

### Example 3: Symfony Service Container

```typescript
await client.callTool('execute_with_loader', {
  code: `<?php
    $container = $kernel->getContainer();
    $services = array_keys($container->getServiceIds());
    echo json_encode($services);
  `,
  loader: 'symfony'
})
```

### Example 4: Multi-Environment Testing

```typescript
// Test on local
await client.callTool('switch_connection', { connectionId: 'local' })
const localResult = await client.callTool('execute_php', { code: testCode })

// Test on staging
await client.callTool('switch_connection', { connectionId: 'staging-ssh' })
const stagingResult = await client.callTool('execute_php', { code: testCode })

// Compare results
console.log('Local:', localResult.data.output)
console.log('Staging:', stagingResult.data.output)
```

## Next Steps

- Read the [API Documentation](./API.md) for complete tool reference
- Review [Error Handling](./ERROR_HANDLING.md) for error recovery strategies
- Check [Troubleshooting Guide](./TROUBLESHOOTING.md) if you encounter issues

## Support

- **GitHub Issues**: [TweakPHP Repository](https://github.com/tweakphp/tweakphp)
- **Documentation**: [MCP Server Docs](./README.md)
- **Logs**: Check `{userData}/logs/mcp-server.log` for detailed error information
