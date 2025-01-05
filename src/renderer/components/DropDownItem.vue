<script lang="ts" setup>
  import { MenuItem } from '@headlessui/vue'
  import { useSettingsStore } from '../stores/settings'
  import { Ref, ref } from 'vue'
  const settingsStore = useSettingsStore()
  const hover: Ref<boolean> = ref(false)
</script>

<template>
  <MenuItem>
    <button
      @mouseover="hover = true"
      @mouseleave="hover = false"
      :class="['group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate']"
      :style="{
        color: settingsStore.colors.foreground,
        backgroundColor: hover ? settingsStore.colors.background : settingsStore.colors.backgroundLight,
      }"
    >
      <slot></slot>
    </button>
  </MenuItem>
</template>
