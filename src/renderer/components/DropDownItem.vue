<script lang="ts" setup>
  import { MenuItem } from '@headlessui/vue'
  import { useSettingsStore } from '../stores/settings'
  const settingsStore = useSettingsStore()
</script>

<template>
  <MenuItem>
    <button
      type="button"
      class="group hover:!bg-primary-500/10 flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate"
      :style="{
        color: settingsStore.colors.foreground,
        backgroundColor: settingsStore.colors.backgroundLight,
      }"
    >
      <slot></slot>
    </button>
  </MenuItem>
</template>
