<script lang="ts" setup>
  import { Menu, MenuButton, MenuItems } from '@headlessui/vue'
  import { useSettingsStore } from '../stores/settings'
  const settingsStore = useSettingsStore()
</script>

<template>
  <Menu as="div" class="relative inline-block">
    <MenuButton class="flex items-center">
      <slot name="trigger"></slot>
    </MenuButton>
    <transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <MenuItems
        class="absolute left-0 mt-2 origin-top-left border divide-y rounded-md shadow-lg focus:outline-none"
        :style="{
          backgroundColor: settingsStore.colors.backgroundLight,
          borderColor: settingsStore.colors.border,
        }"
      >
        <div class="px-1 py-1">
          <slot></slot>
        </div>
      </MenuItems>
    </transition>
  </Menu>
</template>
