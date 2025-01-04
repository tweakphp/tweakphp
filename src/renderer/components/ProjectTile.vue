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
    }"
    class="text-md flex h-8 w-8 items-center justify-center rounded-lg capitalize cursor-pointer hover:shadow-md transition-shadow"
    v-tippy="{ content: props.tooltip, placement: props.tooltipPlacement }"
  >
    <span>
      <slot></slot>
    </span>
  </div>
</template>
