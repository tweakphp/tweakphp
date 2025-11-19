# TweakPHP MCP Server - Documentation Index

## Overview

The TweakPHP MCP Server enables AI coding agents to execute PHP code through TweakPHP's execution infrastructure. This documentation provides everything you need to integrate, use, and troubleshoot the MCP server.

## ✅ Implementation Status

The MCP server is **fully implemented and operational**:

- ✅ HTTP server listening on localhost:3000
- ✅ All 5 tool handlers implemented and tested
- ✅ Router, connection manager, error handling complete
- ✅ Settings UI and configuration working
- ✅ Complete documentation

## Documentation Structure

### For AI Agent Developers

Start here if you're integrating an AI agent with TweakPHP:

1. **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete setup guide
   - Prerequisites and quick start
   - Configuration for Claude Desktop, Cursor, and custom clients
   - Connection setup (local, Docker, SSH, kubectl, Vapor)
   - Common workflows and examples
   - Security best practices

2. **[API.md](./API.md)** - Complete API reference
   - All five tools with parameters and responses
   - Request/response examples
   - Error codes and handling
   - Best practices and rate limiting

3. **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Problem resolution
   - Common issues and solutions
   - Error code reference
   - Debugging techniques
   - Getting help

### For TweakPHP Developers

Start here if you're working on the MCP server implementation:

1. **[README.md](./README.md)** - Implementation overview
   - Architecture and components
   - Tool handlers
   - Integration with TweakPHP components
   - Requirements mapping

2. **[CONFIGURATION.md](./CONFIGURATION.md)** - Configuration system
   - Settings storage and persistence
   - IPC communication
   - Configuration flow
   - Migration strategy

3. **[ERROR_HANDLING.md](./ERROR_HANDLING.md)** - Error handling system
   - Error logger and handler
   - Error classification
   - Recovery strategies
   - Integration patterns

4. **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Task completion summary
   - Implementation status
   - Verification results
   - Files modified and created

## Quick Reference

### Tools

| Tool | Purpose | Documentation |
|------|---------|---------------|
| `execute_php` | Execute PHP code | [API.md#execute_php](./API.md#1-execute_php) |
| `execute_with_loader` | Execute with framework context | [API.md#execute_with_loader](./API.md#2-execute_with_loader) |
| `get_execution_history` | Retrieve execution history | [API.md#get_execution_history](./API.md#3-get_execution_history) |
| `switch_connection` | Switch execution environments | [API.md#switch_connection](./API.md#4-switch_connection) |
| `get_php_info` | Get PHP environment info | [API.md#get_php_info](./API.md#5-get_php_info) |

### Connection Types

| Type | Setup Guide | Use Case |
|------|-------------|----------|
| Local | [SETUP_GUIDE.md#local-connection](./SETUP_GUIDE.md#local-connection-recommended-for-getting-started) | Development on local machine |
| Docker | [SETUP_GUIDE.md#docker-connection](./SETUP_GUIDE.md#docker-connection) | Containerized environments |
| SSH | [SETUP_GUIDE.md#ssh-connection](./SETUP_GUIDE.md#ssh-connection) | Remote servers |
| Kubectl | [SETUP_GUIDE.md#kubernetes-connection](./SETUP_GUIDE.md#kubernetes-connection) | Kubernetes clusters |
| Vapor | [SETUP_GUIDE.md#laravel-vapor-connection](./SETUP_GUIDE.md#laravel-vapor-connection) | Laravel Vapor deployments |

### Common Tasks

| Task | Documentation |
|------|---------------|
| First-time setup | [SETUP_GUIDE.md#quick-start](./SETUP_GUIDE.md#quick-start) |
| Execute simple PHP | [SETUP_GUIDE.md#workflow-1](./SETUP_GUIDE.md#workflow-1-execute-simple-php-code) |
| Test Laravel app | [SETUP_GUIDE.md#workflow-2](./SETUP_GUIDE.md#workflow-2-test-laravel-application) |
| Debug remote server | [SETUP_GUIDE.md#workflow-3](./SETUP_GUIDE.md#workflow-3-debug-remote-server) |
| Review history | [SETUP_GUIDE.md#workflow-4](./SETUP_GUIDE.md#workflow-4-review-execution-history) |
| Server won't start | [TROUBLESHOOTING.md#1-server-wont-start](./TROUBLESHOOTING.md#1-server-wont-start) |
| Connection errors | [TROUBLESHOOTING.md#2-connection-errors](./TROUBLESHOOTING.md#2-connection-errors) |
| Timeout errors | [TROUBLESHOOTING.md#4-timeout-errors](./TROUBLESHOOTING.md#4-timeout-errors) |

## Getting Started

### 1. Enable the Server

```
TweakPHP → Settings → MCP Server → Enable
```

### 2. Configure Your AI Agent

See [SETUP_GUIDE.md#configure-your-ai-agent](./SETUP_GUIDE.md#2-configure-your-ai-agent) for:
- Claude Desktop configuration
- Cursor configuration
- Custom MCP client setup

### 3. Test the Connection

```typescript
const result = await client.callTool('execute_php', {
  code: '<?php echo "Hello from TweakPHP!";'
})
```

### 4. Explore the Tools

See [API.md](./API.md) for complete tool documentation.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Coding Agent                        │
│                  (Claude, Cursor, etc.)                     │
└────────────────────────┬────────────────────────────────────┘
                         │ MCP Protocol
                         │ (localhost:3000)
┌────────────────────────▼────────────────────────────────────┐
│                    TweakPHP MCP Server                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tool Router (Parameter Validation & Routing)        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tool Handlers                                       │  │
│  │  • execute_php                                       │  │
│  │  • execute_with_loader                               │  │
│  │  • get_execution_history                             │  │
│  │  • switch_connection                                 │  │
│  │  • get_php_info                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Connection Manager                                  │  │
│  │  • Active connection tracking                        │  │
│  │  • Client factory                                    │  │
│  │  • Connection storage                                │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Error Handler & Logger                              │  │
│  │  • Error classification                              │  │
│  │  • Retry logic                                       │  │
│  │  • Troubleshooting tips                              │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              TweakPHP Execution Clients                     │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐         │
│  │Local │  │Docker│  │ SSH  │  │Kubectl│ │Vapor │         │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 🚀 Five Powerful Tools
- Execute PHP code in any environment
- Framework-aware execution (Laravel, Symfony)
- Execution history tracking
- Dynamic connection switching
- PHP environment inspection

### 🔒 Security First
- Localhost-only binding (127.0.0.1)
- Automatic credential sanitization
- Sandboxed execution through existing clients
- Comprehensive error logging

### 🛠️ Developer Friendly
- Structured error responses
- Automatic retry logic
- Detailed troubleshooting tips
- Complete TypeScript types

### 📊 Production Ready
- Persistent configuration
- Execution history database
- Log rotation
- Graceful shutdown

## Support & Resources

### Documentation
- **Setup**: [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- **API**: [API.md](./API.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### Code
- **Implementation**: [README.md](./README.md)
- **Configuration**: [CONFIGURATION.md](./CONFIGURATION.md)
- **Error Handling**: [ERROR_HANDLING.md](./ERROR_HANDLING.md)

### Help
- **GitHub Issues**: [TweakPHP Repository](https://github.com/tweakphp/tweakphp)
- **Logs**: `{userData}/logs/mcp-server.log`
- **Examples**: `example-usage.ts`

## Version Information

- **Current Version**: 1.0.0
- **MCP Protocol**: Compatible with @modelcontextprotocol/sdk
- **Supported PHP**: 7.4+
- **Supported Frameworks**: Laravel 8+, Symfony 5+

## Contributing

See the main TweakPHP repository for contribution guidelines.

## License

See the main TweakPHP repository for license information.

---

**Need help?** Start with the [SETUP_GUIDE.md](./SETUP_GUIDE.md) or check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues.
