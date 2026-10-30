<script setup lang="ts">
  import { useSettingsStore } from '../stores/settings'
  import { ref } from 'vue'
  import { whenever } from '@vueuse/core'

  const isHovered = ref(false)

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
    dragging: {
      type: Boolean,
      default: false,
    },
  })

  whenever(
    () => props.dragging,
    () => {
      isHovered.value = false
    }
  )

  const settingsStore = useSettingsStore()
</script>

<template>
  <div
    :style="{
      color: props.active && !props.sidebar ? '' : settingsStore.colors.foreground,
    }"
    :class="{
      'bg-primary-500/15 text-primary-400': props.active && !props.sidebar,
      'bg-black/20 dark:bg-white/15 font-medium': props.active && props.sidebar,
      'bg-black/10 dark:bg-white/10': isHovered && !props.dragging && !props.active && !props.sidebar,
      'bg-black/5 dark:bg-white/5': isHovered && !props.dragging && !props.active && props.sidebar,
      'w-8 justify-center capitalize': !props.expanded,
      'w-full px-3': props.expanded && !props.sidebar,
      'w-full px-2': props.expanded && props.sidebar,
    }"
    @mouseenter="() => { if(!dragging) isHovered = true; }"
    @mouseleave="isHovered = false"
    class="group text-md flex h-8 rounded-lg cursor-pointer transition-all min-w-0"
    v-tippy="{ content: props.tooltip, placement: props.tooltipPlacement }"
  >
    <span class="flex items-center min-w-0" :class="{ 'w-full text-start': props.expanded }">
      <slot></slot>
      <span v-if="$slots.actions" class="hidden group-hover:flex items-center shrink-0 mr-2 gap-1">
        <slot name="actions"></slot>
      </span>
    </span>
  </div>
</template>
