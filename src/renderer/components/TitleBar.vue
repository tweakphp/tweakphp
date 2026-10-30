<script setup lang="ts">
  import {
    PlayIcon,
    ArrowPathIcon,
    DocumentTextIcon,
    RectangleStackIcon,
    QueueListIcon,
    CircleStackIcon,
    BoltIcon,
  } from '@heroicons/vue/24/outline'
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
  import { computed, ComputedRef, watch } from 'vue'
  import { Tab } from '../../types/tab.type'
  import { OutputMode } from '../../types/settings.type'

  const settingsStore = useSettingsStore()
  const executeStore = useExecuteStore()
  const tabStore = useTabsStore()
  const route = useRoute()
  const platform = window.platformInfo.getPlatform()
  const tab: ComputedRef<Tab | null> = computed(() => tabStore.getCurrent())

  const showOutputType = computed(() => {
    return tab.value?.execution !== 'vapor'
  })

  const isRealtimeSupported = computed(() => {
    return tab.value?.execution !== 'vapor'
  })

  const isQueryLogAvailable = computed(() => {
    return settingsStore.settings.outputMode !== 'output'
  })

  const queryLogIconClass = computed(() => {
    if (!isQueryLogAvailable.value) return 'cursor-not-allowed opacity-40'
    return settingsStore.settings.queryLog
      ? 'text-primary-500 hover:text-primary-400'
      : 'opacity-40 hover:text-primary-400'
  })

  watch(
    () => tab.value?.execution,
    value => {
      if (value === 'vapor') {
        settingsStore.settings.outputMode = 'output'
        settingsStore.update()
      }
    },
    { immediate: true }
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

  const outputModes: OutputMode[] = ['output', 'stacked', 'full']

  const outputModeLabels: Record<OutputMode, string> = {
    output: 'Output only',
    stacked: 'Stacked output',
    full: 'Full stack',
  }

  const cycleOutputMode = () => {
    const index = outputModes.indexOf(settingsStore.settings.outputMode)
    settingsStore.settings.outputMode = outputModes[(index + 1) % outputModes.length]
    settingsStore.update()
  }

  const toggleStreaming = () => {
    settingsStore.settings.streaming = !settingsStore.settings.streaming
    settingsStore.update()
  }

  const toggleQueryLog = () => {
    if (settingsStore.settings.outputMode === 'output') return
    settingsStore.settings.queryLog = !settingsStore.settings.queryLog
    settingsStore.update()
  }
</script>

<template>
  <div
    id="title-bar"
    class="fixed top-0 right-0 h-[38px] z-50 left-0 w-full border-b"
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
          'pl-[80px]': platform === 'darwin',
        }"
      >
        <Toolbar v-if="router.currentRoute.value.name === 'code' && tab" />
      </div>
      <div class="flex h-full flex-grow w-full" v-if="platform === 'darwin'"></div>
      <div class="flex-grow-0 flex items-center gap-1">
        <template v-if="router.currentRoute.value.name === 'code' && tab && tab.type === 'code'">
          <SecondaryButton
            without-border
            class="!px-1 h-6"
            v-tippy="{ content: 'Change layout', placement: 'bottom' }"
            @click="updateLayout(settingsStore.settings.layout === 'horizontal' ? 'vertical' : 'horizontal')"
          >
            <VerticalSplitIcon v-if="settingsStore.settings.layout === 'horizontal'" class="cursor-pointer size-7" />
            <HorizontalSplitIcon v-if="settingsStore.settings.layout === 'vertical'" class="cursor-pointer size-7" />
          </SecondaryButton>
          <SecondaryButton
            without-border
            v-if="showOutputType"
            class="!px-2 h-6"
            v-tippy="{
              content: `Output Mode: ${outputModeLabels[settingsStore.settings.outputMode]}`,
              placement: 'bottom',
            }"
            @click="cycleOutputMode"
          >
            <DocumentTextIcon v-if="settingsStore.settings.outputMode === 'output'" class="cursor-pointer size-4" />
            <RectangleStackIcon v-if="settingsStore.settings.outputMode === 'stacked'" class="cursor-pointer size-4" />
            <QueueListIcon v-if="settingsStore.settings.outputMode === 'full'" class="cursor-pointer size-4" />
          </SecondaryButton>
          <SecondaryButton
            without-border
            class="!px-2 h-6"
            v-tippy="{ content: `${platform === 'darwin' ? 'Cmd' : 'Ctrl'} + R`, placement: 'bottom' }"
            @click="execute"
            :disabled="executeStore.executing"
          >
            <ArrowPathIcon v-if="executeStore.executing" :spin="true" class="text-primary-500 animate-spin size-4" />
            <PlayIcon v-else class="size-4 cursor-pointer" />
          </SecondaryButton>
          <SecondaryButton
            without-border
            v-if="isRealtimeSupported"
            class="!px-2 h-6"
            v-tippy="{
              content: `Streaming Output: ${settingsStore.settings.streaming ? 'ON' : 'OFF'}`,
              placement: 'bottom',
            }"
            @click="toggleStreaming"
          >
            <BoltIcon
              class="size-4 cursor-pointer"
              :class="settingsStore.settings.streaming ? 'text-yellow-500 fill-yellow-500/20' : 'opacity-40'"
            />
          </SecondaryButton>
          <SecondaryButton
            without-border
            v-if="router.currentRoute.value.name === 'code' && tab && isRealtimeSupported"
            class="!px-2 h-6"
            :class="isQueryLogAvailable ? '' : 'cursor-not-allowed opacity-40'"
            v-tippy="{
              content: isQueryLogAvailable
                ? `Query Log: ${settingsStore.settings.queryLog ? 'ON' : 'OFF'}`
                : 'Query Log: available in Stacked output or Full stack modes',
              placement: 'bottom',
            }"
            @click="toggleQueryLog"
          >
            <CircleStackIcon class="size-4" :class="queryLogIconClass" />
          </SecondaryButton>
        </template>
      </div>
    </div>
  </div>
</template>
