<script setup lang="ts">
  import { ref } from 'vue'
  import Title from '../../components/Title.vue'
  import Divider from '../../components/Divider.vue'
  import { useSettingsStore } from '../../stores/settings'
  import SelectInput from '../../components/SelectInput.vue'
  import TextInput from '../../components/TextInput.vue'
  import ToastAlert from '@/components/ToastAlert.vue'
  import FormField from '../../components/forms/FormField.vue'

  const showToast = ref(false)
  const settingsStore = useSettingsStore()

  const saveSettings = () => {
    showToast.value = true
    settingsStore.update()
    setTimeout(() => {
      showToast.value = false
    }, 2000)
  }
</script>

<template>
  <div>
    <ToastAlert v-if="showToast" title="Settings Saved" />
    <div class="flex items-center justify-between">
      <Title>Editor</Title>
    </div>
    <p class="mt-2 text-xs opacity-70">Customize how the code editor looks and behaves.</p>
    <Divider class="mt-3" />
    <FormField
      class="mt-3"
      label="Font size"
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
      label="Word wrap"
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
      label="Line numbers"
      align="start"
      description="Show line numbers in the editor gutter."
      divider
    >
      <SelectInput
        id="editor-line-numbers"
        v-model="settingsStore.settings.editorLineNumbers"
        @change="saveSettings()"
        placeholder="Select"
      >
        <option value="on">Enabled</option>
        <option value="off">Disabled</option>
      </SelectInput>
    </FormField>
    <FormField
      class="mt-3"
      label="Indent guides"
      align="start"
      description="Show vertical guide lines marking each indentation level."
      divider
    >
      <SelectInput
        id="editor-indent-guides"
        v-model="settingsStore.settings.editorIndentGuides"
        @change="saveSettings()"
        placeholder="Select"
      >
        <option value="on">Enabled</option>
        <option value="off">Disabled</option>
      </SelectInput>
    </FormField>
    <FormField
      class="mt-3"
      label="Vim mode"
      align="start"
      description="Enable Vim keybindings (modes, motions, commands) in the code editor."
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
  </div>
</template>

<style scoped></style>
