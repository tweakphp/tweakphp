<script lang="ts" setup>
  import Container from '../components/Container.vue'
  import { useSettingsStore } from '../stores/settings'
  const settingsStore = useSettingsStore()
</script>

<template>
  <Container class="flex items-center justify-center">
    <div class="w-full max-w-lg px-5 space-y-3">
      <div class="flex items-center">
        <img src="../../../build/icon.png" alt="" class="size-7 mr-2" />
        <h2 class="text-xl">
          TweakPHP <span class="opacity-50">{{ settingsStore.settings.version }}</span>
        </h2>
      </div>
      <p>To get started, Add a new project.</p>
      <p>Click on the + icon at top left cornet!</p>
    </div>
  </Container>
</template>
