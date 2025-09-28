<script setup lang="ts">
  import { computed } from 'vue'
  import { useToastStore } from '@/stores/toast'

  const toast = useToastStore()

  const isVisible = computed(() => !!toast.message)

  const accentColor = computed(() => {
    switch (toast.type) {
      case 'error':
        return 'var(--vscode-inputValidation-errorBorder, var(--vscode-editorError-foreground, #f14c4c))'
      case 'warning':
        return 'var(--vscode-inputValidation-warningBorder, var(--vscode-editorWarning-foreground, #cca700))'
      case 'info':
      default:
        return 'var(--vscode-inputValidation-infoBorder, var(--vscode-editorInfo-foreground, #3794ff))'
    }
  })
</script>

<template>
  <transition name="toast-fade-slide">
    <div
      v-if="isVisible"
      class="fixed z-[1000] right-4 bottom-4 max-w-md shadow-lg rounded border p-3 pr-8"
      :style="{
        backgroundColor: 'var(--vscode-editorWidget-background, #1e1e1e)',
        color: 'var(--vscode-editor-foreground, #cccccc)',
        borderColor: 'var(--vscode-editorWidget-border, rgba(128,128,128,0.3))',
        boxShadow: '0 8px 24px rgba(0,0,0,0.24), 0 1px 2px rgba(0,0,0,0.4)',
      }"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-start gap-2">
        <span class="mt-[3px] inline-block w-1 h-5 rounded" :style="{ backgroundColor: accentColor }"></span>
        <div class="text-sm select-text whitespace-pre-line">{{ toast.message }}</div>
      </div>

      <button
        class="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded hover:opacity-80"
        :style="{
          color: 'var(--vscode-icon-foreground, var(--vscode-editor-foreground, #cccccc))',
          background: 'transparent',
        }"
        aria-label="Close notification"
        @click="toast.close()"
      >
        ×
      </button>
    </div>
  </transition>
</template>

<style scoped>
  .toast-fade-slide-enter-active,
  .toast-fade-slide-leave-active {
    transition: all 150ms ease;
  }
  .toast-fade-slide-enter-from,
  .toast-fade-slide-leave-to {
    opacity: 0;
    transform: translateY(6px);
  }
</style>
