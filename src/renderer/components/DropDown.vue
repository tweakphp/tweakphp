<script lang="ts" setup>
  import { defineProps } from 'vue'
  import { Menu, MenuButton, MenuItems } from '@headlessui/vue'
  import { useSettingsStore } from '../stores/settings'
  const settingsStore = useSettingsStore()
  const props = defineProps({
    align: {
      type: String,
      default: 'left',
    },
  })
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
        class="absolute mt-2 border divide-y rounded-md shadow-lg focus:outline-none max-h-[200px] overflow-y-auto no-scrollbar"
        :class="{
          'right-0 origin-top-right': props.align === 'right',
          'left-0 origin-top-left': props.align === 'left',
        }"
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
