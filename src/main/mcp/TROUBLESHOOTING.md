# MCP Server Troubleshooting Guide

## Overview

This guide helps you diagnose and resolve common issues with the TweakPHP MCP Server.

## Quick Diagnostics

### Check Server Status

1. Open TweakPHP application
2. Navigate to **Settings** → **MCP Server**
3. Verify **Status** shows "Running"
4. Note the **Port** number
5. Check **Uptime** to confirm server is stable

### Check Logs

Logs are located at:
- **macOS**: `~/Library/Application Support/TweakPHP/logs/mcp-server.log`
- **Windows**: `%APPDATA%\TweakPHP\logs\mcp-server.log`
- **Linux**: `~/.config/TweakPHP/logs/mcp-server.log`

View recent logs:
```bash
tail -f ~/Library/Application\ Support/TweakPHP/logs/mcp-server.log
```

## Common Issues

### 1. Server Won't Start

#### Symptoms
- Status shows "Stopped" in settings
- AI agent cannot connect
- No log entries

#### Possible Causes & Solutions

**Port Already in Use**

Check if another process is using the port:
```bash
# macOS/Linux
lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

**Solution:**
1. Change port in TweakPHP Settings → MCP Server
2. Update AI agent configuration with new port
3. Restart TweakPHP

**Insufficient Permissions**

**Solution:**
1. Run TweakPHP with appropriate permissions
2. Check log file permissions
3. Verify settings file is writable

**TweakPHP Not Running**

**Solution:**
1. Ensure TweakPHP application is running
2. Check system tray for TweakPHP icon
3. Restart TweakPHP application

---

### 2. Connection Errors

#### Symptoms
- Error code: `CONNECTION_ERROR`
- "No active connection available"
- "Failed to connect to..."

#### Possible Causes & Solutions

**No Active Connection Set**

```json
{
  "error": {
    "code": "CONNECTION_ERROR",
    "message": "No active connection available"
  }
}
```

**Solution:**
```typescript
// Set a connection first
await client.callTool('switch_connection', {
  connectionType: 'local',
  connectionConfig: {
    php: '/usr/bin/php'
  }
})
```

**Docker Container Not Running**

```json
{
  "error": {
    "code": "CONNECTION_ERROR",
    "message": "Failed to connect to docker container"
  }
}
```

**Solution:**
```bash
# Check container status
docker ps | grep my-container

# Start container if stopped
docker start my-container

# Verify PHP is available
docker exec my-container php --version
```

**SSH Connection Failed**

```json
{
  "error": {
    "code": "CONNECTION_ERROR",
    "message": "Failed to establish SSH connection"
  }
}
```

**Solution:**
```bash
# Test SSH connection manually
ssh user@host

# Check SSH key permissions
chmod 600 ~/.ssh/id_rsa

# Verify host is reachable
ping host
```

**Kubectl Pod Not Found**

```json
{
  "error": {
    "code": "CONNECTION_ERROR",
    "message": "Pod not found"
  }
}
```

**Solution:**
```bash
# List pods
kubectl get pods -n namespace

# Check pod status
kubectl describe pod pod-name -n namespace

# Verify kubectl is configured
kubectl config current-context
```

---

### 3. Execution Errors

#### Symptoms
- Error code: `EXECUTION_ERROR`
- PHP syntax errors
- Framework initialization failures

#### Possible Causes & Solutions

**PHP Syntax Error**

```json
{
  "error": {
    "code": "EXECUTION_ERROR",
    "message": "PHP execution error",
    "details": {
      "phpError": "Parse error: syntax error, unexpected ';' in Command line code on line 1"
    }
  }
}
```

**Solution:**
1. Review PHP code for syntax errors
2. Test code locally first: `php -r "your code"`
3. Check PHP version compatibility

**Framework Not Found**

```json
{
  "error": {
    "code": "EXECUTION_ERROR",
    "message": "Failed to initialize laravel framework",
    "details": {
      "reason": "Framework files not found at specified path"
    }
  }
}
```

**Solution:**
```bash
# Verify framework files exist
ls -la /path/to/project/artisan  # Laravel
ls -la /path/to/project/bin/console  # Symfony

# Install dependencies
cd /path/to/project
composer install

# Check autoload file
ls -la vendor/autoload.php
```

**Missing PHP Extensions**

```json
{
  "error": {
    "code": "EXECUTION_ERROR",
    "message": "PHP Fatal error: Call to undefined function mb_strlen()"
  }
}
```

**Solution:**
```bash
# Check loaded extensions
php -m

# Install missing extension (example: mbstring)
# macOS (Homebrew)
brew install php@8.3-mbstring

# Ubuntu/Debian
sudo apt-get install php-mbstring

# Verify installation
php -m | grep mbstring
```

---

### 4. Timeout Errors

#### Symptoms
- Error code: `TIMEOUT`
- "Execution exceeded timeout"
- Long-running operations fail

#### Possible Causes & Solutions

**Default Timeout Too Short**

```json
{
  "error": {
    "code": "TIMEOUT",
    "message": "PHP code execution exceeded timeout of 30000ms"
  }
}
```

**Solution:**
```typescript
// Increase timeout for slow operations
await client.callTool('execute_php', {
  code: slowCode,
  timeout: 60000 // 60 seconds
})

// Framework operations need longer timeouts
await client.callTool('execute_with_loader', {
  code: frameworkCode,
  loader: 'laravel',
  timeout: 120000 // 120 seconds
})
```

**Infinite Loop in Code**

**Solution:**
1. Review code for infinite loops
2. Add exit conditions
3. Test code locally first
4. Use `set_time_limit()` in PHP code

**Slow Network Connection**

**Solution:**
1. Test network latency: `ping host`
2. Use local connection for testing
3. Optimize code to reduce execution time
4. Consider caching results

---

### 5. Framework Loader Issues

#### Symptoms
- Framework context not available
- "app() not defined"
- "Class not found"

#### Possible Causes & Solutions

**Wrong Loader Type**

```typescript
// Bad: Using execute_php for framework code
await client.callTool('execute_php', {
  code: '<?php echo app()->version();'  // Won't work!
})

// Good: Using execute_with_loader
await client.callTool('execute_with_loader', {
  code: '<?php echo app()->version();',
  loader: 'laravel'
})
```

**Project Path Not Set**

```json
{
  "error": {
    "code": "EXECUTION_ERROR",
    "message": "Failed to initialize laravel framework"
  }
}
```

**Solution:**
```typescript
// Explicitly set project path
await client.callTool('execute_with_loader', {
  code: frameworkCode,
  loader: 'laravel',
  projectPath: '/var/www/my-laravel-app'
})

// Or switch connection to project directory
await client.callTool('switch_connection', {
  connectionType: 'local',
  connectionConfig: {
    php: '/usr/bin/php',
    path: '/var/www/my-laravel-app'
  }
})
```

**Environment Variables Missing**

**Solution:**
```bash
# Check .env file exists
ls -la /path/to/project/.env

# Verify environment variables
cd /path/to/project
php artisan config:show

# Generate app key if missing
php artisan key:generate
```

---

### 6. AI Agent Connection Issues

#### Symptoms
- AI agent cannot find MCP server
- "Connection refused"
- Tools not available

#### Possible Causes & Solutions

**Wrong Port in Configuration**

**Solution:**
1. Check port in TweakPHP Settings → MCP Server
2. Update AI agent configuration to match
3. Restart AI agent

**TweakPHP Not Running**

**Solution:**
1. Start TweakPHP application
2. Verify server is enabled in settings
3. Check system tray for TweakPHP icon

**Firewall Blocking Connection**

**Solution:**
```bash
# macOS: Check firewall settings
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Allow TweakPHP through firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /Applications/TweakPHP.app

# Windows: Check Windows Firewall
# Control Panel → Windows Defender Firewall → Allow an app
```

**AI Agent Configuration Error**

**Solution:**
1. Verify JSON syntax in configuration file
2. Check file path is correct
3. Restart AI agent after configuration changes
4. Review AI agent logs for errors

---

### 7. Performance Issues

#### Symptoms
- Slow execution times
- High memory usage
- Server becomes unresponsive

#### Possible Causes & Solutions

**Too Many Concurrent Executions**

**Solution:**
1. Limit concurrent requests to 5 or fewer
2. Queue requests in your AI agent
3. Wait for previous execution to complete

**Large Output Data**

**Solution:**
```typescript
// Limit output size in PHP code
$data = array_slice($largeArray, 0, 100);
echo json_encode($data);

// Use pagination for large datasets
$page = 1;
$perPage = 50;
$results = DB::table('users')->skip(($page - 1) * $perPage)->take($perPage)->get();
```

**Memory Leaks**

**Solution:**
```bash
# Monitor TweakPHP memory usage
# macOS
ps aux | grep TweakPHP

# Restart TweakPHP if memory usage is high
# Settings → Quit TweakPHP
# Restart application
```

---

### 8. Execution History Issues

#### Symptoms
- History not saving
- Cannot retrieve history
- Database errors

#### Possible Causes & Solutions

**Database File Locked**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to retrieve execution history",
    "details": {
      "reason": "database is locked"
    }
  }
}
```

**Solution:**
1. Close other applications accessing the database
2. Restart TweakPHP
3. Check file permissions on database file

**Database Corrupted**

**Solution:**
```bash
# Backup database
cp ~/.tweakphp/database.db ~/.tweakphp/database.db.backup

# Check database integrity
sqlite3 ~/.tweakphp/database.db "PRAGMA integrity_check;"

# If corrupted, restore from backup or delete
rm ~/.tweakphp/database.db
# Restart TweakPHP to recreate database
```

**Disk Space Full**

**Solution:**
```bash
# Check disk space
df -h

# Clean up old execution history
# TweakPHP Settings → Clear History
```

---

## Error Code Reference

| Error Code | Common Causes | Quick Fix |
|------------|---------------|-----------|
| `INVALID_PARAMETERS` | Missing or wrong parameter types | Check API documentation |
| `EXECUTION_ERROR` | PHP syntax error, missing extensions | Test code locally first |
| `TIMEOUT` | Code too slow, infinite loop | Increase timeout or optimize code |
| `CONNECTION_ERROR` | Connection not set, service down | Verify connection details |
| `NOT_FOUND` | Invalid connection ID | List available connections |
| `INTERNAL_ERROR` | Database error, unexpected exception | Check logs, restart TweakPHP |

---

## Debugging Techniques

### 1. Enable Verbose Logging

Check logs for detailed error information:
```bash
tail -f ~/Library/Application\ Support/TweakPHP/logs/mcp-server.log | grep ERROR
```

### 2. Test Connections Manually

Before using MCP, test connections directly:

**Local:**
```bash
php -r "echo 'PHP works!';"
```

**Docker:**
```bash
docker exec my-container php -r "echo 'PHP works!';"
```

**SSH:**
```bash
ssh user@host "php -r \"echo 'PHP works!';\""
```

### 3. Isolate the Problem

Test each component separately:

```typescript
// 1. Test server connection
const info = await client.callTool('get_php_info', { section: 'general' })

// 2. Test simple execution
const simple = await client.callTool('execute_php', { code: '<?php echo "test";' })

// 3. Test framework loader
const framework = await client.callTool('execute_with_loader', {
  code: '<?php echo "test";',
  loader: 'laravel'
})
```

### 4. Check PHP Version Compatibility

```typescript
const info = await client.callTool('get_php_info', { section: 'general' })
console.log('PHP Version:', info.data.phpVersion)

// Ensure your code is compatible with this version
```

### 5. Review Execution History

```typescript
// Check recent errors
const history = await client.callTool('get_execution_history', {
  limit: 10,
  filter: { status: 'error' }
})

for (const record of history.data.records) {
  console.log('Error:', record.output)
  console.log('Code:', record.code)
}
```

---

## Getting Help

### Before Asking for Help

1. Check this troubleshooting guide
2. Review server logs
3. Test connection manually
4. Verify PHP version compatibility
5. Try with a simple code example

### Information to Include

When reporting issues, include:

1. **TweakPHP Version**: Help → About
2. **Operating System**: macOS/Windows/Linux version
3. **PHP Version**: From `get_php_info` tool
4. **Connection Type**: local/docker/ssh/kubectl/vapor
5. **Error Message**: Complete error response
6. **Code Sample**: Minimal reproducible example
7. **Logs**: Relevant entries from mcp-server.log

### Where to Get Help

- **GitHub Issues**: [TweakPHP Repository](https://github.com/tweakphp/tweakphp)
- **Documentation**: [MCP Server Docs](./README.md)
- **API Reference**: [API.md](./API.md)
- **Setup Guide**: [SETUP_GUIDE.md](./SETUP_GUIDE.md)

---

## Preventive Measures

### 1. Regular Maintenance

- Clear old execution history periodically
- Monitor disk space
- Keep TweakPHP updated
- Review logs for warnings

### 2. Best Practices

- Always set appropriate timeouts
- Test code locally before remote execution
- Use framework loaders for framework code
- Handle errors gracefully in your AI agent
- Limit concurrent executions

### 3. Monitoring

- Check server status regularly
- Monitor execution history for errors
- Review logs for patterns
- Track performance metrics

---

## Advanced Troubleshooting

### Network Diagnostics

```bash
# Test localhost connectivity
curl http://127.0.0.1:3000

# Check port binding
netstat -an | grep 3000

# Test with telnet
telnet 127.0.0.1 3000
```

### Database Diagnostics

```bash
# Check database file
ls -lh ~/.tweakphp/database.db

# Query database directly
sqlite3 ~/.tweakphp/database.db "SELECT COUNT(*) FROM execution_history;"

# Check table schema
sqlite3 ~/.tweakphp/database.db ".schema execution_history"
```

### Process Diagnostics

```bash
# Check TweakPHP process
ps aux | grep TweakPHP

# Monitor resource usage
top -pid $(pgrep TweakPHP)

# Check open files
lsof -p $(pgrep TweakPHP)
```

---

## Known Issues

### Issue: Server Stops After System Sleep

**Workaround:**
1. Disable MCP server before sleep
2. Re-enable after wake
3. Or restart TweakPHP application

### Issue: High Memory Usage with Large History

**Workaround:**
1. Clear execution history regularly
2. Use pagination when querying history
3. Limit history retention

### Issue: Slow Framework Bootstrapping

**Workaround:**
1. Increase timeout to 60-120 seconds
2. Optimize framework configuration
3. Use caching in framework
4. Consider using `execute_php` for non-framework code

---

## Still Having Issues?

If you've tried everything in this guide and still have problems:

1. **Collect Diagnostic Information**
   - Server logs
   - Error messages
   - System information
   - Steps to reproduce

2. **Create Minimal Reproducible Example**
   - Simplest code that shows the problem
   - Connection configuration
   - Expected vs actual behavior

3. **Report the Issue**
   - GitHub Issues with diagnostic information
   - Include TweakPHP version
   - Describe what you've already tried

We're here to help!
