<script lang="ts" setup>
  import { onMounted } from 'vue'
  import Container from '../components/Container.vue'
  import { useSettingsStore } from '../stores/settings'
  import { useTabsStore } from '../stores/tabs'
  import router from '../router'

  const settingsStore = useSettingsStore()
  const tabsStore = useTabsStore()

  onMounted(() => {
    let currentTab = tabsStore.getCurrent()
    if (currentTab) {
      router.replace({ name: 'code', params: { id: currentTab.id } })
    }
  })
</script>

<template>
  <Container class="flex items-center justify-center">
    <div class="w-full max-w-sm px-5 space-y-3">
      <div class="flex items-center">
        <img src="../../../build/icon.png" alt="" class="size-7 mr-2" />
        <h2 class="text-xl">
          TweakPHP <span class="opacity-50">{{ settingsStore.settings.version }}</span>
        </h2>
      </div>
      <p>To get started, Add a new project.</p>
      <p>Click on the + icon at top left corner!</p>
    </div>
  </Container>
</template>
