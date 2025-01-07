<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useSettingsStore } from '../stores/settings'

  // Define props
  const props = defineProps({
    modelValue: [String, Number],
  })

  const settingsStore = useSettingsStore()

  // Local state for the selected value
  const inputValue = ref(props.modelValue)

  // Emit the change event to update the parent component
  const emit = defineEmits(['update:modelValue'])

  const emitChange = () => {
    emit('update:modelValue', inputValue.value)
  }

  // Watch for changes in the prop modelValue to update the local state
  watch(
    () => props.modelValue,
    newValue => {
      inputValue.value = newValue
    }
  )
</script>

<template>
  <input
    type="text"
    v-model="inputValue"
    @input="emitChange"
    class="text-sm h-7 outline py-1 px-2 focus:!outline-primary-500 rounded-md"
    :style="{
      backgroundColor: settingsStore.colors.backgroundLight,
      color: settingsStore.colors.foreground,
      outlineColor: settingsStore.colors.border,
    }"
    v-bind="$attrs"
  />
</template>
