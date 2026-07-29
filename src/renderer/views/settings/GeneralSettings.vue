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
      <Title>Settings</Title>
    </div>
    <Divider class="mt-3" />
    <div class="mt-3 grid grid-cols-2 items-center">
      <div>App version</div>
      <div class="flex items-center justify-between w-full">
        <span v-if="!updateStore.downloading">{{ settingsStore.settings.version }}</span>
        <UpdateApp class="flex-1" />
      </div>
    </div>
    <Divider class="mt-3" />
    <div class="mt-3 grid grid-cols-2 items-start">
      <div class="pt-2">PHP path</div>
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
            <button
              v-for="p in detectedPaths"
              :key="p"
              type="button"
              @click="selectDetectedPhp(p)"
              class="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] text-left truncate max-w-[280px]"
              :title="p"
            >
              {{ p }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <Divider class="mt-3" />
    <div class="mt-3 grid grid-cols-2 items-center">
      <div>Theme</div>
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
    </div>
    <Divider class="mt-3" />
    <div class="mt-3 grid grid-cols-2 items-center">
      <div>Editor font size</div>
      <TextInput id="editor-font-size" v-model="settingsStore.settings.editorFontSize" @change="saveSettings()" />
    </div>
    <Divider class="mt-3" />
    <div class="mt-3 grid grid-cols-2 items-center">
      <div>Editor word wrap</div>
      <SelectInput
        id="editor-word-wrap"
        v-model="settingsStore.settings.editorWordWrap"
        @change="saveSettings()"
        placeholder="Select"
      >
        <option value="on">Wrap</option>
        <option value="off">No Wrap</option>
      </SelectInput>
    </div>
    <Divider class="mt-3" />
    <div class="mt-3 grid grid-cols-2 items-center">
      <div>Vim mode</div>
      <SelectInput
        id="editor-vim-mode"
        v-model="settingsStore.settings.vimMode"
        @change="saveSettings()"
        placeholder="Select"
      >
        <option value="on">Enabled</option>
        <option value="off">Disabled</option>
      </SelectInput>
    </div>
    <Divider class="mt-3" />
    <div class="mt-3 grid grid-cols-2 items-start">
      <div>Intelephense License key</div>
      <div class="flex flex-col gap-1">
        <TextInput
          id="intelephense-license-key"
          v-model="settingsStore.settings.intelephenseLicenseKey"
          @change="saveSettings()"
          type="password"
          placeholder="Optional — paste your license to enable premium features"
          autocomplete="off"
        />
        <span class="text-[11px] opacity-60"
          >Leave empty to use the free version. Changes restart the PHP language server.</span
        >
      </div>
    </div>
    <Divider class="mt-3" />
    <div class="mt-3 grid grid-cols-2 items-center">
      <div>Stacked Dump</div>
      <SelectInput
        id="editor-vim-mode"
        v-model="settingsStore.settings.stackedDump"
        @change="saveSettings()"
        placeholder="Select"
      >
        <option value="compact">Compact</option>
        <option value="extended">Extended</option>
      </SelectInput>
    </div>
    <Divider class="mt-3" />
    <div class="mt-3 grid grid-cols-2 items-center">
      <div>Navigation Display</div>
      <SelectInput
        id="navigation-display"
        v-model="settingsStore.settings.navigationDisplay"
        @change="saveSettings()"
        placeholder="Select"
      >
        <option value="collapsed">Collapsed</option>
        <option value="expanded">Expanded</option>
      </SelectInput>
    </div>
    <Divider class="mt-3" />
    <div class="mt-3 grid grid-cols-2 items-center">
      <div>Streaming Output</div>
      <SelectInput
        id="streaming-output"
        v-model="settingsStore.settings.streaming"
        @change="saveSettings()"
        placeholder="Select"
      >
        <option :value="true">Enabled</option>
        <option :value="false">Disabled</option>
      </SelectInput>
    </div>
  </div>
</template>

<style scoped></style>
