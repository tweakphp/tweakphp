<script setup lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { useSettingsStore } from '../stores/settings'
  import { computed } from 'vue'

  const props = defineProps({
    class: {
      type: String,
      default: '',
    },
    withoutBorder: {
      type: Boolean,
      default: false,
    },
  })

  const baseClasse = computed(() => {
    const baseClass =
      'cursor-pointer inline-flex h-8 text-sm w-max min-w-max items-center justify-center rounded-md bg-transparent px-4 py-1 text-white transition'
    const borderClass = !props.withoutBorder
      ? 'border hover:bg-opacity-50 disabled:opacity-25'
      : 'border-transparent hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-25'
    return twMerge(baseClass, borderClass, props.class)
  })

  const settingsStore = useSettingsStore()
</script>

<template>
  <button
    type="button"
    :class="baseClasse"
    :style="{ borderColor: settingsStore.colors.border, color: settingsStore.colors.foreground }"
  >
    <slot></slot>
  </button>
</template>

<style scoped></style>
