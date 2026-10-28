<script setup lang="ts">
  import Title from '../../components/Title.vue'
  import Divider from '../../components/Divider.vue'
  import { useSettingsStore } from '../../stores/settings'
  import { useUpdateStore } from '../../stores/update'
  import SelectInput from '../../components/SelectInput.vue'
  import TextInput from '../../components/TextInput.vue'
  import SecondaryButton from '../../components/SecondaryButton.vue'
  import { ref, onMounted } from 'vue'
  import UpdateApp from '../../components/UpdateApp.vue'
  import ToastAlert from '@/components/ToastAlert.vue'
  import FormField from '../../components/forms/FormField.vue'

  const saved = ref(false)
  const showToast = ref(false)
  const detecting = ref(false)
  const detectedPaths = ref<string[]>([])
  const settingsStore = useSettingsStore()
  const updateStore = useUpdateStore()

  onMounted(() => {
    window.ipcRenderer.on('settings.php-located', updatePhpSetting)
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
    detecting.value = true
    window.ipcRenderer.send('settings.detect-php')
    window.ipcRenderer.once('settings.detect-php.reply', (paths: string[]) => {
      detecting.value = false
      detectedPaths.value = paths || []
    })
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
    <FormField class="mt-3" label="App version" divider>
      <div class="flex items-center justify-between w-full">
        <span v-if="!updateStore.downloading">{{ settingsStore.settings.version }}</span>
        <UpdateApp class="flex-1" />
      </div>
    </FormField>
    <FormField class="mt-3" label="PHP path" align="start" label-class="pt-2" divider>
      <div class="flex flex-col w-full">
        <div class="flex items-center space-x-2 w-full">
          <TextInput id="php" v-model="settingsStore.settings.php" @change="saveSettings()" class="flex-1" />
          <SecondaryButton @click="detectPhp()" :disabled="detecting" class="whitespace-nowrap select-none">
            {{ detecting ? 'Scanning...' : 'Detect' }}
          </SecondaryButton>
        </div>
        <div v-if="detectedPaths.length > 0" class="mt-2 text-xs flex flex-col items-start w-full">
          <span class="opacity-50 mb-1">Detected paths:</span>
          <div class="flex flex-wrap gap-1 w-full max-h-24 overflow-y-auto pr-1">
            <SecondaryButton
              v-for="p in detectedPaths"
              :key="p"
              @click="selectDetectedPhp(p)"
              class="!h-auto !border-transparent !bg-zinc-800 hover:!bg-zinc-700 !px-2 !py-1 !text-[10px] !text-white text-left truncate max-w-[280px]"
              :title="p"
            >
              {{ p }}
            </SecondaryButton>
          </div>
        </div>
      </div>
    </FormField>
    <FormField class="mt-3" label="Theme" divider>
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
    <FormField class="mt-3" label="Editor font size" divider>
      <TextInput
        id="editor-font-size"
        v-model="settingsStore.settings.editorFontSize"
        @change="saveSettings()"
        class="w-full"
      />
    </FormField>
    <FormField class="mt-3" label="Editor word wrap" divider>
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
    <FormField class="mt-3" label="Vim mode" divider>
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
    <FormField class="mt-3" label="Stacked Dump" divider>
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
    <FormField class="mt-3" label="Streaming Output" divider>
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
    <FormField class="mt-3" label="Query Log" divider>
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
    <FormField class="mt-3" label="Docker/Kubernetes timeout (seconds)">
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
