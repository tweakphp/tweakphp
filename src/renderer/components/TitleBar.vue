<script setup lang="ts">
  import { PlayIcon, ArrowPathIcon, XMarkIcon, CodeBracketIcon, RectangleStackIcon } from '@heroicons/vue/24/outline'
  import events from '../events'
  import { useRoute } from 'vue-router'
  import router from '../router'
  import HorizontalSplitIcon from './icons/HorizontalSplitIcon.vue'
  import VerticalSplitIcon from './icons/VerticalSplitIcon.vue'
  import { useSettingsStore } from '../stores/settings'
  import { useExecuteStore } from '../stores/execute'
  import { useVaporStore } from '../stores/vapor'
  import Toolbar from './Toolbar.vue'
  import { useTabsStore } from '../stores/tabs'
  import SecondaryButton from './SecondaryButton.vue'
  import { computed, ComputedRef, watch } from 'vue'
  import { Tab } from '../../types/tab.type'

  const settingsStore = useSettingsStore()
  const executeStore = useExecuteStore()
  const tabStore = useTabsStore()
  const vaporStore = useVaporStore()
  const route = useRoute()
  const platform = window.platformInfo.getPlatform()
  const tab: ComputedRef<Tab | null> = computed(() => tabStore.getCurrent())

  const showOutputType = computed(() => {
    return tab.value?.execution !== 'vapor'
  })

  watch(
    () => tab.value?.execution,
    value => {
      if (value === 'vapor') {
        settingsStore.settings.output = 'code'
        settingsStore.update()
      }
    }
  )

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

  const updateOutput = (output: 'code' | 'stack') => {
    settingsStore.settings.output = output
    settingsStore.update()
  }

  const removeTab = (id: number) => {
    tabStore.removeTab(id)
    vaporStore.removeVaporConfig(id)
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
      <div
        class="flex-grow-0 transition-all duration-300"
        :class="{
          'pl-[70px]': platform === 'darwin',
          'pl-[50px]': platform !== 'darwin' && !settingsStore.isNavigationExpanded,
          'pl-48': platform !== 'darwin' && settingsStore.isNavigationExpanded,
        }"
      >
        <Toolbar v-if="router.currentRoute.value.name === 'code' && tab" />
      </div>
      <div class="flex h-full flex-grow w-full" v-if="platform === 'darwin'"></div>
      <div class="flex-grow-0 flex items-center space-x-2">
        <template v-if="router.currentRoute.value.name === 'code' && tab && tab.type === 'code'">
          <SecondaryButton
            class="!px-1"
            v-tippy="{ content: 'Change layout', placement: 'left' }"
            @click="updateLayout(settingsStore.settings.layout === 'horizontal' ? 'vertical' : 'horizontal')"
          >
            <VerticalSplitIcon
              v-if="settingsStore.settings.layout === 'horizontal'"
              class="cursor-pointer size-7 hover:!stroke-primary-500"
            />
            <HorizontalSplitIcon
              v-if="settingsStore.settings.layout === 'vertical'"
              class="cursor-pointer size-7 hover:!stroke-primary-500"
            />
          </SecondaryButton>
          <SecondaryButton
            v-if="showOutputType"
            class="!px-2"
            v-tippy="{ content: 'Output Style', placement: 'bottom' }"
            @click="updateOutput(settingsStore.settings.output === 'stack' ? 'code' : 'stack')"
          >
            <CodeBracketIcon
              v-if="settingsStore.settings.output === 'stack'"
              class="cursor-pointer size-4 hover:!stroke-primary-500"
            />
            <RectangleStackIcon
              v-if="settingsStore.settings.output === 'code'"
              class="cursor-pointer size-4 hover:!stroke-primary-500"
            />
          </SecondaryButton>
          <SecondaryButton
            class="!px-2"
            v-tippy="{ content: `${platform === 'darwin' ? 'Cmd' : 'Ctrl'} + R`, placement: 'bottom' }"
            @click="execute"
            :disabled="executeStore.executing"
          >
            <ArrowPathIcon v-if="executeStore.executing" :spin="true" class="text-primary-500 animate-spin size-4" />
            <PlayIcon v-else class="size-4 cursor-pointer hover:text-primary-500" />
          </SecondaryButton>
          <SecondaryButton
            v-if="tab"
            class="!px-2"
            v-tippy="{ content: 'Remove', placement: 'bottom' }"
            @click="removeTab(tab.id)"
          >
            <XMarkIcon class="size-4" />
          </SecondaryButton>
        </template>
      </div>
    </div>
  </div>
</template>
