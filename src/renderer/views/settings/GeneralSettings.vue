<script setup lang="ts">
  import Title from '../../components/Title.vue'
  import Divider from '../../components/Divider.vue'
  import { useSettingsStore } from '../../stores/settings'
  import SelectInput from '../../components/SelectInput.vue'
  import TextInput from '../../components/TextInput.vue'
  import { ref } from 'vue'
  import UpdateApp from '../../components/UpdateApp.vue'

  const saved = ref(false)
  const settingsStore = useSettingsStore()

  const saveSettings = () => {
    saved.value = true
    settingsStore.update()
    setTimeout(() => {
      saved.value = false
    }, 2000)
  }
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <Title>Settings</Title>
      <span :class="{ 'opacity-0': !saved, 'opacity-65': saved }" class="transition-all duration-300">
        Changes Saved
      </span>
    </div>
    <Divider class="mt-3" />
    <div class="mt-3 grid grid-cols-2 items-center">
      <div>App version</div>
      <div class="flex items-center justify-between">
        {{ settingsStore.settings.version }}
        <UpdateApp />
      </div>
    </div>
    <Divider class="mt-3" />
    <div class="mt-3 grid grid-cols-2 items-center">
      <div>PHP path</div>
      <TextInput id="php" v-model="settingsStore.settings.php" @change="saveSettings()" />
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
  </div>
</template>

<style scoped></style>
