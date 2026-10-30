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

  // SortableJS takes the native drag image (and clones the ghost) right after
  // the dragstart handlers run, before Vue can flush the reactive class
  // update: clear the hover background synchronously, inline, so the snapshot
  // does not carry it for the whole drag.
  const onDragStart = (event: DragEvent) => {
    const el = event.currentTarget as HTMLElement
    el.style.transition = 'none'
    el.style.background = 'transparent'
  }

  // Drop the inline background forced in onDragStart and let the class-driven
  // hover styling take over again.
  const restoreBackground = (event: Event) => {
    const el = event.currentTarget as HTMLElement
    el.style.background = ''
    el.style.transition = ''
  }

  const onMouseEnter = (event: Event) => {
    restoreBackground(event)
    if (!props.dragging) {
      isHovered.value = true
    }
  }

  const onMouseLeave = (event: Event) => {
    restoreBackground(event)
    isHovered.value = false
  }

  const settingsStore = useSettingsStore()
</script>

<template>
  <div
    :style="{
      color: props.active ? '' : settingsStore.colors.foreground,
    }"
    :class="{
      'bg-primary-500/15 text-primary-400': props.active,
      'font-medium': props.active && props.sidebar,
      'bg-primary-500/10': isHovered && !props.dragging && !props.active,
      'w-8 justify-center capitalize': !props.expanded,
      'w-full px-3': props.expanded && !props.sidebar,
      'w-full px-2': props.expanded && props.sidebar,
    }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @dragstart="onDragStart"
    @dragend="restoreBackground"
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
