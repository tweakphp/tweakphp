<script setup lang="ts">
  import { PlayIcon, ArrowPathIcon, XMarkIcon } from '@heroicons/vue/24/outline'
  import events from '../events'
  import { useRoute } from 'vue-router'
  import router from '../router'
  import HorizontalSplitIcon from './icons/HorizontalSplitIcon.vue'
  import VerticalSplitIcon from './icons/VerticalSplitIcon.vue'
  import { useSettingsStore } from '../stores/settings'
  import { useExecuteStore } from '../stores/execute'
  import Toolbar from './Toolbar.vue'
  import { useTabsStore } from '../stores/tabs'
  import SecondaryButton from './SecondaryButton.vue'
  import { computed, ComputedRef } from 'vue'
  import { Tab } from '../../types/tab.type'

  const settingsStore = useSettingsStore()
  const executeStore = useExecuteStore()
  const tabStore = useTabsStore()
  const route = useRoute()
  const platform = window.platformInfo.getPlatform()
  const tab: ComputedRef<Tab | null> = computed(() => tabStore.getCurrent())

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
        <Toolbar v-if="router.currentRoute.value.name === 'code' && tab" />
      </div>
      <div class="flex h-full flex-grow w-full drag" v-if="platform === 'darwin'"></div>
      <div class="flex-grow-0 flex items-center space-x-2">
        <template v-if="router.currentRoute.value.name === 'code' && tab && tab.type === 'code'">
          <SecondaryButton v-tippy="{ content: 'Change layout', placement: 'left' }" class="!px-1">
            <VerticalSplitIcon
              @click="updateLayout('vertical')"
              v-if="settingsStore.settings.layout === 'horizontal'"
              class="cursor-pointer size-7 hover:!stroke-primary-500"
            />
            <HorizontalSplitIcon
              @click="updateLayout('horizontal')"
              v-if="settingsStore.settings.layout === 'vertical'"
              class="cursor-pointer size-7 hover:!stroke-primary-500"
            />
          </SecondaryButton>
          <SecondaryButton
            class="!px-2 !w-5"
            v-tippy="{ content: `${platform === 'darwin' ? 'Cmd' : 'Ctrl'} + R`, placement: 'bottom' }"
          >
            <ArrowPathIcon v-if="executeStore.executing" :spin="true" class="text-primary-500 animate-spin size-4" />
            <PlayIcon
              v-if="!executeStore.executing"
              @click="execute"
              class="size-4 cursor-pointer hover:text-primary-500"
            />
          </SecondaryButton>
          <SecondaryButton
            v-if="tab"
            class="!px-2"
            v-tippy="{ content: 'Close', placement: 'bottom' }"
            @click="tabStore.removeTab(tab.id)"
          >
            <XMarkIcon class="size-4" />
          </SecondaryButton>
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
