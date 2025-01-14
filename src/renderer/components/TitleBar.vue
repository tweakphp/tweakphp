<script setup lang="ts">
  import { PlayIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'
  import events from '../events'
  import { useRoute } from 'vue-router'
  import router from '../router'
  import HorizontalSplitIcon from './icons/HorizontalSplitIcon.vue'
  import VerticalSplitIcon from './icons/VerticalSplitIcon.vue'
  import { useSettingsStore } from '../stores/settings'
  import { useExecuteStore } from '../stores/execute'
  import Toolbar from './Toolbar.vue'
  import { useTabsStore } from '../stores/tabs'

  const settingsStore = useSettingsStore()
  const executeStore = useExecuteStore()
  const tabStore = useTabsStore()
  const route = useRoute()
  const platform = window.platformInfo.getPlatform()

  const execute = () => {
    if (route.name !== 'code') {
      router.push({ name: 'home' })
      return
    }
    events.dispatchEvent(new CustomEvent('execute', { detail: null }))
  }

  const updateLayout = (layout: any) => {
    settingsStore.settings.layout = layout
    settingsStore.update()
  }
</script>

<template>
  <div
    id="title-bar"
    class="fixed top-0 right-0 h-[38px] z-40 left-0 w-full border-b"
    :style="{
      backgroundColor: settingsStore.colors.background,
      borderColor: settingsStore.colors.border,
    }"
  >
    <div
      class="absolute right-0 w-full left-0 h-full px-2 flex items-center justify-between"
      :style="{
        backgroundColor: settingsStore.colors.background,
      }"
    >
      <div class="flex-grow-0" :class="{ 'pl-[70px]': platform === 'darwin', 'pl-[50px]': platform !== 'darwin' }">
        <Toolbar v-if="router.currentRoute.value.name === 'code' && tabStore.getCurrent()" />
      </div>
      <div class="flex h-full flex-grow w-full drag" v-if="platform === 'darwin'"></div>
      <div class="flex-grow-0 flex items-center space-x-1">
        <template v-if="tabStore.current && tabStore.current.type === 'code'">
          <button type="button" v-tippy="{ content: 'Change layout', placement: 'left' }" class="-mr-[4px]">
            <VerticalSplitIcon
              @click="updateLayout('vertical')"
              v-if="settingsStore.settings.layout === 'horizontal'"
              class="cursor-pointer size-8 hover:!stroke-primary-500"
            />
            <HorizontalSplitIcon
              @click="updateLayout('horizontal')"
              v-if="settingsStore.settings.layout === 'vertical'"
              class="cursor-pointer size-8 hover:!stroke-primary-500"
            />
          </button>
          <button
            type="button"
            v-tippy="{ content: `${platform === 'darwin' ? 'Cmd' : 'Ctrl'} + R`, placement: 'bottom' }"
          >
            <ArrowPathIcon v-if="executeStore.executing" :spin="true" class="text-primary-500 animate-spin size-5" />
            <PlayIcon
              v-if="!executeStore.executing"
              @click="execute"
              class="size-5 cursor-pointer hover:text-primary-500"
            />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .drag {
    -webkit-app-region: drag;
  }
</style>
