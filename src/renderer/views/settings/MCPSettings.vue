<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed } from 'vue'
  import Title from '../../components/Title.vue'
  import Divider from '../../components/Divider.vue'
  import SwitchInput from '../../components/SwitchInput.vue'
  import TextInput from '../../components/TextInput.vue'
  import PrimaryButton from '../../components/PrimaryButton.vue'
  import SecondaryButton from '../../components/SecondaryButton.vue'
  import { useSettingsStore } from '../../stores/settings'
  import FormField from '../../components/forms/FormField.vue'

  const settingsStore = useSettingsStore()
  const saved = ref(false)
  const serverStatus = ref({
    running: false,
    port: 0,
    uptime: 0,
    requestCount: 0,
    errorCount: 0,
  })
  const isStarting = ref(false)
  const isStopping = ref(false)

  let statusInterval: NodeJS.Timeout | null = null

  const mcpEnabled = computed({
    get: () => settingsStore.settings.mcpEnabled ?? false,
    set: async (value: boolean) => {
      settingsStore.settings.mcpEnabled = value

      // Await the save so the main process has the updated settings on disk
      // before mcp.settings-changed triggers a start/stop/restart
      await window.ipcRenderer.invoke('settings.save', { ...settingsStore.settings })

      // Notify main process about settings change
      window.ipcRenderer.send('mcp.settings-changed', value)

      // Fetch updated status after a short delay
      setTimeout(fetchServerStatus, 500)
    },
  })

  const mcpPort = computed({
    get: () => settingsStore.settings.mcpPort ?? 3000,
    set: (value: string | number) => {
      const numeric = typeof value === 'number' ? value : Number(value)
      if (Number.isNaN(numeric) || numeric < 1 || numeric > 65535) return
      settingsStore.settings.mcpPort = numeric
    },
  })

  const activePort = computed(() => (serverStatus.value.running ? serverStatus.value.port : mcpPort.value))

  const configSnippet = computed(
    () =>
      `{\n  "mcpServers": {\n    "tweakphp": {\n      "url": "http://127.0.0.1:${activePort.value}/mcp",\n      "type": "http"\n    }\n  }\n}`
  )

  const copyConfig = () => {
    navigator.clipboard.writeText(configSnippet.value)
  }

  const formatUptime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const saveSettings = () => {
    saved.value = true
    settingsStore.update()
    setTimeout(() => {
      saved.value = false
    }, 2000)
  }

  const onPortChange = () => {
    saveSettings()
    if (mcpEnabled.value) {
      window.ipcRenderer.send('mcp.settings-changed', true)
    }
  }

  const fetchServerStatus = async () => {
    try {
      const status = await window.ipcRenderer.invoke('mcp.get-status')
      if (status) {
        serverStatus.value = status
      }
    } catch (error) {
      console.error('Failed to fetch MCP server status:', error)
    }
  }

  const handleStatusUpdate = (status: any) => {
    serverStatus.value = status
  }

  const startServer = async () => {
    isStarting.value = true
    try {
      const config = {
        enabled: true,
        port: mcpPort.value,
        host: '127.0.0.1',
        authEnabled: false,
        timeout: 30000,
        maxConcurrentExecutions: 5,
      }
      const result = await window.ipcRenderer.invoke('mcp.start', config)
      if (result.success) {
        await fetchServerStatus()
      } else {
        console.error('Failed to start server:', result.error)
      }
    } catch (error) {
      console.error('Error starting server:', error)
    } finally {
      isStarting.value = false
    }
  }

  const stopServer = async () => {
    isStopping.value = true
    try {
      const result = await window.ipcRenderer.invoke('mcp.stop')
      if (result.success) {
        await fetchServerStatus()
      } else {
        console.error('Failed to stop server:', result.error)
      }
    } catch (error) {
      console.error('Error stopping server:', error)
    } finally {
      isStopping.value = false
    }
  }

  onMounted(() => {
    // Fetch initial status
    fetchServerStatus()

    // Listen for status updates from main process
    window.ipcRenderer.on('mcp.status-update', handleStatusUpdate)

    // Poll for status updates every 2 seconds as fallback
    statusInterval = setInterval(fetchServerStatus, 2000)
  })

  onUnmounted(() => {
    if (statusInterval) {
      clearInterval(statusInterval)
    }

    // Remove status update listener
    window.ipcRenderer.removeListener('mcp.status-update', handleStatusUpdate)
  })
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <Title>MCP Server</Title>
      <span :class="{ 'opacity-0': !saved, 'opacity-65': saved }" class="transition-all duration-300">
        Changes Saved
      </span>
    </div>
    <p class="mt-2 text-xs opacity-70">Expose TweakPHP to AI coding agents through the Model Context Protocol.</p>
    <Divider class="mt-3" />

    <FormField
      class="mt-3"
      label="Enable MCP Server"
      align="start"
      description="Allow AI coding agents to execute PHP code through TweakPHP via the Model Context Protocol"
      divider
    >
      <SwitchInput v-model="mcpEnabled" />
    </FormField>

    <FormField class="mt-3" label="Server Port" divider>
      <TextInput
        id="mcp-port"
        v-model="mcpPort"
        class="w-full"
        type="number"
        :disabled="!mcpEnabled"
        @change="onPortChange"
        placeholder="3000"
      />
    </FormField>

    <FormField class="mt-3" label="Server Status" align="start" divider>
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full" :class="serverStatus.running ? 'bg-green-500' : 'bg-gray-400'"></div>
          <span>{{ serverStatus.running ? 'Running' : 'Stopped' }}</span>
        </div>
        <div v-if="serverStatus.running" class="text-[11px] opacity-60 space-y-1">
          <div>Port: {{ serverStatus.port }}</div>
          <div>Uptime: {{ formatUptime(serverStatus.uptime) }}</div>
          <div>Requests: {{ serverStatus.requestCount }}</div>
          <div>Errors: {{ serverStatus.errorCount }}</div>
        </div>
        <div class="flex gap-2 mt-2">
          <PrimaryButton v-if="!serverStatus.running && mcpEnabled" @click="startServer" :disabled="isStarting">
            {{ isStarting ? 'Starting...' : 'Start Server' }}
          </PrimaryButton>
          <SecondaryButton v-if="serverStatus.running" @click="stopServer" :disabled="isStopping">
            {{ isStopping ? 'Stopping...' : 'Stop Server' }}
          </SecondaryButton>
        </div>
      </div>
    </FormField>

    <FormField class="mt-3" label="Connection Info" align="start">
      <div class="flex flex-col gap-2">
        <div v-if="!mcpEnabled" class="text-[11px] opacity-60">Enable the MCP server to allow AI agent connections</div>
        <template v-else>
          <div class="text-[11px] opacity-60">Add to your AI agent config (Claude Desktop, Cursor, VS Code, etc.):</div>
          <div class="relative">
            <pre class="text-[10px] bg-gray-800 p-2 rounded leading-relaxed select-all overflow-x-auto">{{
              configSnippet
            }}</pre>
            <SecondaryButton
              class="!absolute !top-1 !right-1 !h-auto !rounded !border-transparent !bg-gray-700 !px-1.5 !py-0.5 !text-[10px] opacity-50 hover:opacity-100"
              @click="copyConfig"
            >
              copy
            </SecondaryButton>
          </div>
        </template>
      </div>
    </FormField>
  </div>
</template>

<style scoped></style>
