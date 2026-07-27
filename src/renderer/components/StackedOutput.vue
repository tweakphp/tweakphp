<script lang="ts" setup>
  import { nextTick, PropType, watch } from 'vue'
  import { Result } from '../../types/tab.type'
  import { useSettingsStore } from '../stores/settings'

  const props = defineProps({
    output: {
      type: Array as PropType<Result[]>,
      required: true,
    },
  })

  const settingsStore = useSettingsStore()
  const initializedDumps = new WeakSet<HTMLElement>()

  const applyDump = async () => {
    await nextTick()
    props.output.forEach(item => {
      if (item.htmlReady === false) return

      const el = document.getElementById(`dump-${item.line}`)?.querySelector<HTMLElement>('.sf-dump')
      if (el && !initializedDumps.has(el)) {
        window.Sfdump(el.id)
        initializedDumps.add(el)
        if (settingsStore.settings.stackedDump === 'compact') {
          const dump = el.querySelector<HTMLElement>('samp')
          const toggle = dump?.previousElementSibling

          if (
            dump?.classList.contains('sf-dump-expanded') &&
            toggle instanceof HTMLElement &&
            toggle.matches('a.sf-dump-toggle')
          ) {
            toggle.click()
          }
        }
      }
    })
  }

  watch(() => props.output.map(item => `${item.line}:${item.htmlReady}:${item.html}`), applyDump, {
    flush: 'post',
    immediate: true,
  })
</script>

<template>
  <div
    class="flex flex-col w-full h-full overflow-y-auto p-3 space-y-3 font-mono"
    :style="{
      backgroundColor: settingsStore.colors.background,
    }"
  >
    <div
      v-for="item in props.output.filter(
        item => (item.output && item.output !== '') || (item.html && item.html !== '')
      )"
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
        v-html="item.htmlReady === false ? item.output : item.html || item.output"
        :style="{
          // fontSize: settingsStore.settings.editorFontSize + 'px !important',
        }"
      ></div>
    </div>
  </div>
</template>
