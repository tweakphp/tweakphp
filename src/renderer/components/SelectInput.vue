<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useSettingsStore } from '../stores/settings'

  // Define props
  const props = defineProps({
    modelValue: [String, Number],
    placeholder: [String],
  })

  const settingsStore = useSettingsStore()

  // Local state for the selected value
  const selectedValue = ref(props.modelValue)

  // Emit the change event to update the parent component
  const emit = defineEmits(['update:modelValue'])

  const emitChange = () => {
    emit('update:modelValue', selectedValue.value)
  }

  // Watch for changes in the prop modelValue to update the local state
  watch(
    () => props.modelValue,
    newValue => {
      selectedValue.value = newValue
    }
  )
</script>

<template>
  <div>
    <select
      v-model="selectedValue"
      @change="emitChange"
      class="!w-full h-7 text-sm border-r-8 border-transparent py-1 px-2 outline focus:!outline-primary-500 rounded-md"
      :style="{
        backgroundColor: settingsStore.colors.backgroundLight,
        color: settingsStore.colors.foreground,
        outlineColor: settingsStore.colors.border,
      }"
    >
      <option value="" selected disabled>
        {{ placeholder }}
      </option>
      <slot></slot>
    </select>
  </div>
</template>
