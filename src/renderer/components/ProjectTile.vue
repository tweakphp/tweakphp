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
    sidebar: {
      type: Boolean,
      default: false,
    },
  })

  const settingsStore = useSettingsStore()
</script>

<template>
  <div
    :style="{
      color: props.active && !props.sidebar ? '' : settingsStore.colors.foreground,
    }"
    :class="{
      'bg-primary-500/15 text-primary-400': props.active && !props.sidebar,
      'bg-black/15 dark:bg-white/15 font-medium': props.active && props.sidebar,
      'w-8 justify-center capitalize': !props.expanded,
      'w-full px-3': props.expanded && !props.sidebar,
      'w-full px-2': props.expanded && props.sidebar,
    }"
    class="text-md flex h-8 rounded-lg cursor-pointer transition-all min-w-0"
    v-tippy="{ content: props.tooltip, placement: props.tooltipPlacement }"
  >
    <span class="flex items-center min-w-0" :class="{ 'w-full text-start': props.expanded }">
      <slot></slot>
    </span>
  </div>
</template>
