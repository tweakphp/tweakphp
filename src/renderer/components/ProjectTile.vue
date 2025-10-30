<script setup lang="ts">
  import { useSettingsStore } from '../stores/settings'

  const props = defineProps({
    name: String,
    tooltip: String,
    tooltipPlacement: {
      type: String,
      default: 'top',
    },
    active: {
      type: Boolean,
      default: false,
    },
    expanded: {
      type: Boolean,
      default: false,
    },
  })

  const settingsStore = useSettingsStore()
</script>

<template>
  <div
    :style="{
      color: props.active ? '' : settingsStore.colors.foreground,
      borderColor: settingsStore.colors.border,
    }"
    :class="{
      'bg-gradient-to-r from-primary-500 to-primary-800 text-white shadow-md': props.active,
      'border': !props.active,
      'w-8 justify-center capitalize': !props.expanded,
      'w-full px-3': props.expanded,
    }"
    class="text-md flex h-8 rounded-lg cursor-pointer hover:shadow-md transition-all"
    v-tippy="{ content: props.tooltip, placement: props.tooltipPlacement }"
  >
    <span class="flex items-center" :class="{ 'w-full text-start': props.expanded }">
      <slot></slot>
    </span>
  </div>
</template>
