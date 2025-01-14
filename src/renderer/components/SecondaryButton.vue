<script setup lang="ts">
  import { useSettingsStore } from '../stores/settings'

  const props = defineProps({
    class: {},
  })

  const settingsStore = useSettingsStore()
</script>

<template>
  <button
    type="button"
    :class="[
      'inline-flex h-6 text-sm w-max min-w-max items-center justify-center rounded-md border bg-transparent px-4 py-1 text-white transition hover:bg-opacity-50 disabled:opacity-25',
      props.class,
    ]"
    :style="{ borderColor: settingsStore.colors.border, color: settingsStore.colors.foreground }"
  >
    <slot></slot>
  </button>
</template>

<style scoped></style>
