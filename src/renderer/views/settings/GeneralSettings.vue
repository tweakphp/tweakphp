<script setup lang="ts">
  import Title from '../../components/Title.vue'
  import Divider from '../../components/Divider.vue'
  import { useSettingsStore } from '../../stores/settings'
  import { useUpdateStore } from '../../stores/update'
  import SelectInput from '../../components/SelectInput.vue'
  import TextInput from '../../components/TextInput.vue'
  import SecondaryButton from '../../components/SecondaryButton.vue'
  import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
  import UpdateApp from '../../components/UpdateApp.vue'
  import ToastAlert from '@/components/ToastAlert.vue'
  import FormField from '../../components/forms/FormField.vue'
  import DetectedPhpList from '../../components/DetectedPhpList.vue'
  import events from '../../events'

  const saved = ref(false)
  const showToast = ref(false)
  const detecting = ref(false)
  const hasScanned = ref(false)
  const detectedPaths = ref<string[]>([])
  const phpFieldRef = ref<HTMLElement | null>(null)
  const settingsStore = useSettingsStore()
  const updateStore = useUpdateStore()
  const route = useRoute()

  const isPhpPathMissing = computed(() => !(settingsStore.settings.php ?? '').trim())

  let pendingDetectReply: ((paths: string[]) => void) | null = null

  const clearDetectListener = () => {
    if (pendingDetectReply) {
      window.ipcRenderer.removeListener('settings.detect-php.reply', pendingDetectReply)
      pendingDetectReply = null
    }
  }

  const focusPhpInput = async () => {
    await nextTick()
    const input = phpFieldRef.value?.querySelector<HTMLInputElement>('input')
    input?.focus()
  }

  onMounted(() => {
    window.ipcRenderer.on('settings.php-located', updatePhpSetting)
    events.addEventListener('settings.focus-php', focusPhpInput)
    if (route.query.missingPhp === '1') {
      void focusPhpInput()
    }
  })

  onBeforeUnmount(() => {
    window.ipcRenderer.removeListener('settings.php-located', updatePhpSetting)
    events.removeEventListener('settings.focus-php', focusPhpInput)
    clearDetectListener()
  })

  const updatePhpSetting = (newPhpSetting: string) => {
    settingsStore.settings.php = newPhpSetting
  }

  const saveSettings = () => {
    saved.value = true
    showToast.value = true
    settingsStore.update()
    setTimeout(() => {
      saved.value = false
      showToast.value = false
    }, 2000)
  }

  const detectPhp = () => {
    if (detecting.value) return
    clearDetectListener()
    detecting.value = true
    hasScanned.value = false
    pendingDetectReply = (paths: string[]) => {
      pendingDetectReply = null
      detecting.value = false
      hasScanned.value = true
      detectedPaths.value = paths || []
    }
    window.ipcRenderer.once('settings.detect-php.reply', pendingDetectReply)
    window.ipcRenderer.send('settings.detect-php')
  }

  const selectDetectedPhp = (p: string) => {
    settingsStore.settings.php = p
    saveSettings()
  }
</script>

<template>
  <div>
    <ToastAlert v-if="showToast" title="Settings Saved" />
    <div class="flex items-center justify-between">
      <Title>General</Title>
    </div>
    <p class="mt-2 text-xs opacity-70">Configure application preferences, the PHP executable, and editor behavior.</p>
    <Divider class="mt-3" />
    <FormField
      class="mt-3"
      label="App version"
      align="start"
      description="Current application version, with a check for available updates."
      divider
    >
      <div class="flex items-center justify-between w-full">
        <span v-if="!updateStore.downloading">{{ settingsStore.settings.version }}</span>
        <UpdateApp class="flex-1" />
      </div>
    </FormField>
    <FormField
      class="mt-3"
      label="PHP path"
      align="start"
      description="Absolute path to the PHP binary used to run your code. Click Detect to scan common locations."
      label-class="pt-2"
      divider
    >
      <div ref="phpFieldRef" class="flex flex-col w-full">
        <div
          v-if="isPhpPathMissing"
          role="alert"
          class="mb-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs"
        >
          <ExclamationTriangleIcon class="mt-0.5 size-4 shrink-0 text-amber-500" />
          <div class="min-w-0 flex-1">
            <p class="font-medium text-amber-600 dark:text-amber-400">PHP path is not set</p>
            <p class="mt-0.5 opacity-80">Required to run local PHP code. Enter the path below or click Detect.</p>
          </div>
        </div>
        <div class="flex items-center gap-2 w-full">
          <TextInput
            id="php"
            v-model="settingsStore.settings.php"
            placeholder="e.g. C:\php\php.exe or /usr/bin/php"
            :class="['flex-1 h-8 font-mono text-xs', isPhpPathMissing ? '!outline-amber-500/60' : '']"
            @change="saveSettings()"
          />
          <SecondaryButton @click="detectPhp()" :disabled="detecting" class="whitespace-nowrap select-none">
            <ArrowPathIcon class="mr-1.5 size-4" :class="{ 'animate-spin': detecting }" />
            {{ detecting ? 'Scanning...' : 'Detect' }}
          </SecondaryButton>
        </div>
        <DetectedPhpList
          v-if="detectedPaths.length > 0"
          class="mt-2.5"
          :paths="detectedPaths"
          :selected-path="settingsStore.settings.php"
          dismissible
          @select="selectDetectedPhp"
          @dismiss="detectedPaths = []"
        />
        <p v-else-if="hasScanned && !detecting" class="mt-2 text-xs opacity-60">
          No PHP binaries detected automatically. Please enter the path manually.
        </p>
      </div>
    </FormField>
    <FormField
      class="mt-3"
      label="Theme"
      align="start"
      description="Color scheme applied to the interface and the code editor."
      divider
    >
      <SelectInput
        id="theme"
        v-model="settingsStore.settings.theme"
        @change="saveSettings()"
        placeholder="Select a theme"
      >
        <option v-for="theme in settingsStore.themes" :value="theme">
          {{ theme }}
        </option>
      </SelectInput>
    </FormField>
    <FormField
      class="mt-3"
      label="Editor font size"
      align="start"
      description="Font size (in pixels) used in the code editor."
      divider
    >
      <TextInput
        id="editor-font-size"
        v-model="settingsStore.settings.editorFontSize"
        @change="saveSettings()"
        class="w-full"
      />
    </FormField>
    <FormField
      class="mt-3"
      label="Editor word wrap"
      align="start"
      description="Wrap long lines onto the next line instead of requiring horizontal scrolling."
      divider
    >
      <SelectInput
        id="editor-word-wrap"
        v-model="settingsStore.settings.editorWordWrap"
        @change="saveSettings()"
        placeholder="Select"
      >
        <option value="on">Wrap</option>
        <option value="off">No Wrap</option>
      </SelectInput>
    </FormField>
    <FormField
      class="mt-3"
      label="Vim mode"
      align="start"
      description="Enable Vim keybindings (modes, motions, commands) in the code editor."
      divider
    >
      <SelectInput
        id="editor-vim-mode"
        v-model="settingsStore.settings.vimMode"
        @change="saveSettings()"
        placeholder="Select"
      >
        <option value="on">Enabled</option>
        <option value="off">Disabled</option>
      </SelectInput>
    </FormField>
    <FormField
      class="mt-3"
      label="Intelephense License key"
      align="start"
      description="Leave empty to use the free version. Changes restart the PHP language server."
      divider
    >
      <TextInput
        id="intelephense-license-key"
        v-model="settingsStore.settings.intelephenseLicenseKey"
        @change="saveSettings()"
        type="password"
        class="w-full"
        placeholder="Optional — add license to enable premium features"
        autocomplete="off"
      />
    </FormField>
    <FormField
      class="mt-3"
      label="Stacked Dump"
      align="start"
      description="Display format of stacked dump cards: Compact shows a condensed view, Extended shows full detail."
      divider
    >
      <SelectInput
        id="editor-vim-mode"
        v-model="settingsStore.settings.stackedDump"
        @change="saveSettings()"
        placeholder="Select"
      >
        <option value="compact">Compact</option>
        <option value="extended">Extended</option>
      </SelectInput>
    </FormField>
    <FormField
      class="mt-3"
      label="Output Mode"
      align="start"
      description="Choose what the result panel shows: only explicit output such as echo, dump, or var_dump, explicit output as rich dump cards, or everything including intermediate values."
      divider
    >
      <SelectInput
        id="output-mode"
        v-model="settingsStore.settings.outputMode"
        @change="saveSettings()"
        placeholder="Select"
      >
        <option value="output">Output only</option>
        <option value="stacked">Stacked output</option>
        <option value="full">Full stack</option>
      </SelectInput>
    </FormField>
    <FormField
      class="mt-3"
      label="Streaming Output"
      align="start"
      description="Show output progressively while the code runs, instead of only at the end."
      divider
    >
      <SelectInput
        id="streaming-output"
        v-model="settingsStore.settings.streaming"
        @change="saveSettings()"
        placeholder="Select"
      >
        <option :value="true">Enabled</option>
        <option :value="false">Disabled</option>
      </SelectInput>
    </FormField>
    <FormField
      class="mt-3"
      label="Query Log"
      align="start"
      description="Log executed database queries so you can inspect them in the query log view."
      divider
    >
      <SelectInput
        id="query-log"
        v-model="settingsStore.settings.queryLog"
        @change="saveSettings()"
        placeholder="Select"
      >
        <option :value="true">Enabled</option>
        <option :value="false">Disabled</option>
      </SelectInput>
    </FormField>
    <FormField
      class="mt-3"
      label="Docker/Kubernetes timeout (seconds)"
      align="start"
      description="Maximum time in seconds to wait for Docker or Kubernetes command execution before timing out."
    >
      <TextInput
        id="docker-kubectl-execution-timeout"
        class="w-full"
        v-model.number="settingsStore.settings.dockerKubectlExecutionTimeoutSeconds"
        @change="saveSettings()"
        type="number"
        min="1"
        max="3600"
        step="1"
      />
    </FormField>
  </div>
</template>

<style scoped></style>
