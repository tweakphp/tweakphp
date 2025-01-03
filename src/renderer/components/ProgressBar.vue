<script setup lang="ts">
  import { ref } from 'vue'

  const title = ref<string>('')
  const progress = ref<number>(0)

  window.ipcRenderer.on('statusbar.progress', e => {
    title.value = e.title
    progress.value = e.progress
  })
</script>

<template>
  <div class="w-44">
    <div v-show="progress < 100" class="flex gap-2 w-full h-1.5 items-center">
      <div class="whitespace-nowrap opacity-75">{{ title }}</div>
      <div class="progress-bar h-full rounded-md bg-green-500" :style="{ width: (progress || 0) + '%' }"></div>
    </div>
  </div>
</template>
<style scoped>
  .progress-bar {
    transition: width 0.2ms ease-in-out;
  }
</style>
