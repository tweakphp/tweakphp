<script setup lang="ts">
  import DropDown from '../DropDown.vue'
  import DropDownItem from '../DropDownItem.vue'
  import { computed } from 'vue'
  import { useSettingsStore } from '../../stores/settings'

  const COLORS = [
    'slate',
    'gray',
    'red',
    'orange',
    'amber',
    'yellow',
    'lime',
    'green',
    'emerald',
    'teal',
    'cyan',
    'sky',
    'blue',
    'indigo',
    'violet',
    'purple',
    'fuchsia',
    'pink',
    'rose',
  ]

  const props = defineProps<{
    modelValue: string
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
  }>()

  const settingsStore = useSettingsStore()

  const selected = computed({
    get: () => props.modelValue,
    set: (value: string) => emit('update:modelValue', value),
  })
</script>

<template>
  <DropDown align="right" class="flex-grow-0">
    <template #trigger>
      <div
        class="!w-full h-7 text-sm border-transparent py-1 px-2 outline focus:!outline-primary-500 rounded-md flex items-center"
        :style="{
          backgroundColor: settingsStore.colors.backgroundLight,
          color: settingsStore.colors.foreground,
          outlineColor: settingsStore.colors.border,
        }"
      >
        <div class="size-4 rounded-full" :class="[`bg-${selected}-500`]"></div>
      </div>
    </template>
    <div class="space-y-1">
      <DropDownItem v-for="color in COLORS" :key="`color-${color}`" @click="selected = color" class="flex items-center">
        <span class="size-4 rounded-full mr-1" :class="[`bg-${color}-500`]"></span>
        <span>{{ color }}</span>
      </DropDownItem>
    </div>
  </DropDown>
</template>
