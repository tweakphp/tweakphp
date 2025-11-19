# MCP Server Configuration and Persistence

## Overview

The MCP server configuration is fully integrated with TweakPHP's settings system, providing persistent storage of server preferences across application restarts.

## Configuration Storage

### Settings Location

Settings are stored in a JSON file:
- **Development**: `src/main/settings.json`
- **Production**: `~/.tweakphp/settings.json`

### MCP Settings Schema

```typescript
interface Settings {
  // ... other settings
  mcpEnabled?: boolean  // Whether MCP server is enabled (default: false)
  mcpPort?: number      // Port number for MCP server (default: 3000)
}
```

## Implementation Details

### 1. Settings Type Definition (`src/types/settings.type.ts`)

The `Settings` interface includes optional MCP configuration fields:

```typescript
export interface Settings {
  // ... other fields
  mcpEnabled?: boolean
  mcpPort?: number
}
```

### 2. Default Settings (`src/main/settings.ts`)

Default values are defined for MCP settings:

```typescript
const defaultSettings: Settings = {
  // ... other defaults
  mcpEnabled: false,
  mcpPort: 3000,
}
```

### 3. Settings Persistence

**Saving Settings:**
```typescript
export const setSettings = async (data: Settings) => {
  fs.writeFileSync(settingsPath, JSON.stringify(data))
}
```

**Loading Settings:**
```typescript
export const getSettings = () => {
  // ... load from file
  settings = {
    // ... other fields
    mcpEnabled: settingsJson.mcpEnabled ?? defaultSettings.mcpEnabled,
    mcpPort: settingsJson.mcpPort || defaultSettings.mcpPort,
  }
  return settings
}
```

Note: Uses nullish coalescing (`??`) for `mcpEnabled` to properly handle `false` values.

### 4. MCP Server Integration (`src/main/mcp/index.ts`)

The MCP server reads settings on startup:

```typescript
const startServerFromSettings = async (): Promise<void> => {
  const settings = getSettings()
  const server = getMCPServer()

  if (settings.mcpEnabled && !server.isRunning()) {
    const config: MCPServerConfig = {
      enabled: true,
      port: settings.mcpPort || 3000,
      host: '127.0.0.1',
      authEnabled: false,
      timeout: 30000,
      maxConcurrentExecutions: 5,
    }

    await server.start(config)
  }
}
```

### 5. UI Integration (`src/renderer/views/settings/MCPSettings.vue`)

The settings UI provides controls for MCP configuration:

**Enable/Disable Toggle:**
```typescript
const mcpEnabled = computed({
  get: () => settingsStore.settings.mcpEnabled ?? false,
  set: async (value: boolean) => {
    settingsStore.settings.mcpEnabled = value
    saveSettings()
    window.ipcRenderer.send('mcp.settings-changed', value)
  },
})
```

**Port Configuration:**
```typescript
const mcpPort = computed({
  get: () => settingsStore.settings.mcpPort ?? 3000,
  set: (value: number) => {
    settingsStore.settings.mcpPort = value
  },
})
```

**Saving Settings:**
```typescript
const saveSettings = () => {
  saved.value = true
  settingsStore.update() // Triggers IPC call to main process
  setTimeout(() => {
    saved.value = false
  }, 2000)
}
```

### 6. Settings Store (`src/renderer/stores/settings.ts`)

The Pinia store manages settings state and synchronization:

```typescript
const settings = ref<Settings>({
  // ... other defaults
  mcpEnabled: false,
  mcpPort: 3000,
})

const update = () => {
  window.ipcRenderer.send('settings.store', {
    ...settings.value,
  })
}
```

## Configuration Flow

### Application Startup

1. `main.ts` initializes modules including `mcp.init()`
2. `mcp/index.ts` calls `startServerFromSettings()`
3. `getSettings()` loads persisted configuration from disk
4. If `mcpEnabled` is `true`, server starts with configured port
5. UI receives initial status via `mcp.get-status` IPC call

### User Changes Settings

1. User toggles MCP enabled switch or changes port in UI
2. Vue computed setter updates `settingsStore.settings`
3. `saveSettings()` calls `settingsStore.update()`
4. Store sends `settings.store` IPC message to main process
5. Main process writes settings to disk via `setSettings()`
6. For enable/disable changes, UI also sends `mcp.settings-changed` IPC
7. Main process starts or stops server based on new state
8. Status update broadcast to all renderer windows

### Application Restart

1. Settings are loaded from disk on startup
2. MCP server automatically starts if `mcpEnabled` is `true`
3. Server uses persisted `mcpPort` value
4. UI reflects current state from loaded settings

## IPC Communication

### Main Process Handlers

- `settings.store` - Saves all settings to disk
- `mcp.get-status` - Returns current server status
- `mcp.start` - Starts server with provided config
- `mcp.stop` - Stops running server
- `mcp.settings-changed` - Handles enable/disable toggle

### Renderer Process Events

- `mcp.status-update` - Receives server status updates
- `settings.php-located` - Receives PHP path updates

## Configuration Validation

### Port Validation

- Default: 3000
- Valid range: 1024-65535 (recommended)
- Localhost binding only (`127.0.0.1`)

### Enable State Validation

- Type: boolean
- Default: false (opt-in)
- Uses nullish coalescing to handle explicit `false` values

## Migration Strategy

### Backward Compatibility

Settings files without MCP fields are handled gracefully:

```typescript
mcpEnabled: settingsJson.mcpEnabled ?? defaultSettings.mcpEnabled,
mcpPort: settingsJson.mcpPort || defaultSettings.mcpPort,
```

This ensures:
- Existing installations default to MCP disabled
- Missing fields use default values
- No migration script required

## Security Considerations

1. **Localhost Only**: Server always binds to `127.0.0.1`
2. **Opt-in**: MCP server disabled by default
3. **No Network Exposure**: Settings don't allow external binding
4. **Persistent State**: User choice persists across restarts

## Testing Configuration

### Manual Testing Checklist

- [ ] Enable MCP server in settings
- [ ] Verify settings persist after app restart
- [ ] Change port number and verify persistence
- [ ] Disable MCP server and verify it doesn't start on restart
- [ ] Verify server starts with correct port from settings
- [ ] Test with missing settings file (should use defaults)
- [ ] Test with settings file missing MCP fields (should use defaults)

### Configuration Scenarios

1. **Fresh Install**: `mcpEnabled: false`, `mcpPort: 3000`
2. **User Enables**: `mcpEnabled: true`, `mcpPort: 3000`
3. **Custom Port**: `mcpEnabled: true`, `mcpPort: 4000`
4. **User Disables**: `mcpEnabled: false`, `mcpPort: 4000` (port preserved)
5. **After Restart**: Settings match last saved state

## Troubleshooting

### Settings Not Persisting

1. Check file permissions on settings directory
2. Verify settings path: `~/.tweakphp/settings.json` (production)
3. Check console for write errors
4. Ensure `setSettings()` is called after changes

### Server Not Starting on Restart

1. Verify `mcpEnabled` is `true` in settings file
2. Check for port conflicts
3. Review MCP server logs for startup errors
4. Ensure `mcp.init()` is called in `main.ts`

### Port Changes Not Applied

1. Stop server before changing port
2. Restart server after port change
3. Verify settings saved before restart
4. Check for port validation errors

## Future Enhancements

Potential configuration additions:

- [ ] Timeout configuration (currently hardcoded to 30s)
- [ ] Max concurrent executions (currently hardcoded to 5)
- [ ] Authentication settings (currently disabled)
- [ ] Custom host binding (currently localhost only)
- [ ] Auto-start preference (currently based on enabled state)
- [ ] Log level configuration
- [ ] Connection retry settings
