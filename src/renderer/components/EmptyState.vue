<script setup lang="ts">
  import { useSettingsStore } from '../stores/settings'

  const settingsStore = useSettingsStore()

  defineProps<{
    title?: string
    message?: string
    bordered?: boolean
  }>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center text-center"
    :class="bordered ? 'rounded-lg border border-dashed px-6 py-8 bg-primary-500/[0.03]' : 'py-6 px-4'"
    :style="bordered ? { borderColor: settingsStore.colors.border } : undefined"
  >
    <div
      v-if="$slots.icon"
      class="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500 ring-1 ring-primary-500/20"
    >
      <slot name="icon" />
    </div>
    <p v-if="title" class="text-sm font-medium">
      {{ title }}
    </p>
    <p v-if="message || $slots.default" class="text-xs max-w-xs leading-relaxed" :class="{ 'mt-1': title }">
      <slot>
        <span class="opacity-60">{{ message }}</span>
      </slot>
    </p>
    <div v-if="$slots.action" class="mt-4">
      <slot name="action" />
    </div>
  </div>
</template>
