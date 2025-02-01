<script lang="ts" setup>
  import { nextTick, onBeforeUnmount, onMounted, PropType } from 'vue'
  import { Result } from '../../types/tab.type'
  import { useSettingsStore } from '../stores/settings'
  import eventBus from '../events'

  const props = defineProps({
    output: {
      type: Array as PropType<Result[]>,
      required: true,
    },
  })

  const settingsStore = useSettingsStore()

  onMounted(() => {
    applyDump()
    eventBus.addEventListener('client.execute.reply', applyDump)
  })

  onBeforeUnmount(() => {
    eventBus.removeEventListener('client.execute.reply', applyDump)
  })

  const applyDump = async () => {
    await nextTick()
    props.output.forEach(item => {
      const el = document.getElementById(`dump-${item.line}`)?.querySelector('.sf-dump')
      if (el) {
        window.Sfdump(el.id)
        if (settingsStore.settings.stackedDump === 'compact') {
          el.querySelector('samp')?.classList.replace('sf-dump-expanded', 'sf-dump-compact')
        }
      }
    })
  }
</script>

<template>
  <div
    class="flex flex-col w-full h-full overflow-y-auto p-3 space-y-3 font-mono"
    :style="{
      backgroundColor: settingsStore.colors.background,
    }"
  >
    <div
      v-for="item in props.output.filter(item => item.output !== '')"
      :key="`stack-${item.line}`"
      class="w-full rounded-md relative p-3 border"
      :style="{
        backgroundColor: settingsStore.colors.backgroundLight,
        borderColor: settingsStore.colors.border,
        color: settingsStore.colors.foreground,
      }"
    >
      <div class="absolute top-0 right-0 px-2 py-1 bg-opacity-50 text-xs bg-black/10 rounded-tr-md" :style="{}">
        Line {{ item.line }}
      </div>
      <div
        :id="`dump-${item.line}`"
        class="text-sm"
        v-html="item.html ?? item.output"
        :style="{
          // fontSize: settingsStore.settings.editorFontSize + 'px !important',
        }"
      ></div>
    </div>
  </div>
</template>
