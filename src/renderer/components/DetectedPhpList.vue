<script setup lang="ts">
  import { CheckCircleIcon } from '@heroicons/vue/24/solid'
  import { useSettingsStore } from '../stores/settings'

  const props = withDefaults(
    defineProps<{
      paths: string[]
      selectedPath: string
      dismissible?: boolean
    }>(),
    {
      dismissible: false,
    }
  )

  const emit = defineEmits<{
    (e: 'select', path: string): void
    (e: 'dismiss'): void
  }>()

  const settingsStore = useSettingsStore()

  const getSourceLabel = (binaryPath: string): string | null => {
    const normalized = binaryPath.toLowerCase().replace(/\\/g, '/')
    if (normalized.startsWith('//wsl.localhost/') || normalized.startsWith('//wsl$/')) return 'WSL'
    if (normalized.includes('/herd/')) return 'Herd'
    if (normalized.includes('/laragon/')) return 'Laragon'
    if (normalized.includes('/xampp/')) return 'XAMPP'
    if (normalized.includes('/lerd/')) return 'Lerd'
    if (normalized.includes('/homebrew/')) return 'Homebrew'
    return null
  }

  const isSelected = (binaryPath: string): boolean => props.selectedPath.trim() === binaryPath
</script>

<template>
  <div v-if="props.paths.length > 0" class="w-full space-y-1.5">
    <div class="flex items-center justify-between text-[11px]">
      <span class="font-medium opacity-60">Detected PHP binaries ({{ props.paths.length }})</span>
      <button
        v-if="props.dismissible"
        type="button"
        class="opacity-50 transition-opacity hover:opacity-100"
        @click="emit('dismiss')"
      >
        Hide
      </button>
    </div>
    <div
      class="max-h-48 overflow-y-auto rounded-md border divide-y"
      :style="{
        backgroundColor: settingsStore.colors.backgroundLight,
        borderColor: settingsStore.colors.border,
      }"
    >
      <button
        v-for="binaryPath in props.paths"
        :key="binaryPath"
        type="button"
        class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors"
        :class="isSelected(binaryPath) ? 'bg-primary-500/10' : 'hover:bg-primary-500/5'"
        :style="{
          borderColor: settingsStore.colors.border,
          color: settingsStore.colors.foreground,
        }"
        :title="binaryPath"
        :aria-pressed="isSelected(binaryPath)"
        @click="emit('select', binaryPath)"
      >
        <span class="flex min-w-0 flex-1 items-center gap-2.5">
          <CheckCircleIcon v-if="isSelected(binaryPath)" class="size-4 shrink-0 text-primary-500" />
          <span v-else class="flex size-4 shrink-0 items-center justify-center">
            <span
              class="size-2.5 rounded-full border opacity-35"
              :style="{ borderColor: settingsStore.colors.foreground }"
            />
          </span>
          <span class="min-w-0 flex-1 truncate font-mono text-xs" :class="isSelected(binaryPath) ? 'font-medium' : ''">
            {{ binaryPath }}
          </span>
        </span>
        <span
          v-if="getSourceLabel(binaryPath)"
          class="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium opacity-75"
          :style="{
            backgroundColor: settingsStore.colors.background,
            borderColor: settingsStore.colors.border,
          }"
        >
          {{ getSourceLabel(binaryPath) }}
        </span>
      </button>
    </div>
  </div>
</template>
