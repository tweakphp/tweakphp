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
      <Title>Output</Title>
    </div>
    <p class="mt-2 text-xs opacity-70">Choose what the result panel shows and how it looks.</p>
    <Divider class="mt-3" />
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
      label="Font size"
      align="start"
      description="Font size (in pixels) of the result panel. Applies in Output only mode."
      divider
    >
      <TextInput
        id="output-font-size"
        v-model="settingsStore.settings.outputFontSize"
        @change="saveSettings()"
        class="w-full"
      />
    </FormField>
    <FormField
      class="mt-3"
      label="Word wrap"
      align="start"
      description="Wrap long output lines instead of requiring horizontal scrolling. Applies in Output only mode."
      divider
    >
      <SelectInput
        id="output-word-wrap"
        v-model="settingsStore.settings.outputWordWrap"
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
      description="Show line numbers in the result panel gutter. Applies in Output only mode."
      divider
    >
      <SelectInput
        id="output-line-numbers"
        v-model="settingsStore.settings.outputLineNumbers"
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
      description="Show vertical guide lines marking each indentation level. Applies in Output only mode."
      divider
    >
      <SelectInput
        id="output-indent-guides"
        v-model="settingsStore.settings.outputIndentGuides"
        @change="saveSettings()"
        placeholder="Select"
      >
        <option value="on">Enabled</option>
        <option value="off">Disabled</option>
      </SelectInput>
    </FormField>
    <FormField
      class="mt-3"
      label="Stacked Dump"
      align="start"
      description="Display format of stacked dump cards: Compact shows a condensed view, Extended shows full detail."
      divider
    >
      <SelectInput
        id="stacked-dump"
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
      label="Streaming Output"
      align="start"
      description="Show output progressively while the code runs, instead of only at the end."
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
  </div>
</template>

<style scoped></style>
