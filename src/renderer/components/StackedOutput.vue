<script lang="ts" setup>
  import { nextTick, PropType, watch } from 'vue'
  import { QueryItem, Result } from '../../types/tab.type'
  import { useSettingsStore } from '../stores/settings'

  const props = defineProps({
    output: {
      type: Array as PropType<Result[]>,
      required: true,
    },
  })

  const settingsStore = useSettingsStore()
  const initializedDumps = new WeakSet<HTMLElement>()

  const getSql = (item: QueryItem): string => {
    if (typeof item === 'string') return item
    return item.sql || item.query || item.raw_sql || item.statement || ''
  }

  const interpolateSql = (item: QueryItem): string => {
    const sql = getSql(item)
    if (typeof item === 'string' || !Array.isArray(item.bindings) || item.bindings.length === 0) return sql

    let bindingIndex = 0
    return sql.replace(/\?/g, () => {
      if (bindingIndex >= item.bindings!.length) return '?'
      const value = item.bindings![bindingIndex++]
      if (value === null || value === undefined) return 'NULL'
      if (typeof value === 'boolean') return value ? '1' : '0'
      if (typeof value === 'number') return String(value)
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
      return `'${JSON.stringify(value)}'`
    })
  }

  const formatTime = (item: QueryItem): string => {
    if (typeof item === 'string') return ''
    const rawTime = item.time ?? item.duration ?? item.execution_time
    const time = typeof rawTime === 'string' ? parseFloat(rawTime) : rawTime
    if (!time || isNaN(time)) return ''
    return time < 1 ? `${(time * 1000).toFixed(2)} μs` : `${time.toFixed(2)} ms`
  }

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
        item =>
          (item.output && item.output !== '') ||
          (item.html && item.html !== '') ||
          (item.queries && item.queries.length > 0) ||
          (item.query_errors && item.query_errors.length > 0)
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

      <div
        v-for="(query, queryIndex) in item.queries || []"
        :key="`stack-${item.line}-query-${queryIndex}`"
        class="mt-3 rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-xs"
      >
        <div class="mb-2 flex items-center justify-between font-sans text-[10px]">
          <span class="font-semibold text-blue-400">Query {{ queryIndex + 1 }}</span>
          <span v-if="formatTime(query)" class="text-blue-300/70">{{ formatTime(query) }}</span>
        </div>
        <pre class="whitespace-pre-wrap break-words leading-relaxed text-gray-300">{{ interpolateSql(query) }}</pre>
        <div
          v-if="typeof query !== 'string' && query.bindings && query.bindings.length > 0"
          class="mt-2 flex flex-wrap items-center gap-1.5 font-sans text-[10px] text-gray-400"
        >
          <span class="text-gray-500">Bindings:</span>
          <span
            v-for="(binding, bindingIndex) in query.bindings"
            :key="bindingIndex"
            class="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-gray-300"
          >
            {{ binding === null ? 'null' : String(binding) }}
          </span>
        </div>
      </div>

      <div
        v-for="(error, errorIndex) in item.query_errors || []"
        :key="`stack-${item.line}-query-error-${errorIndex}`"
        class="mt-3 rounded border border-red-500/20 bg-red-500/10 px-3 py-2 font-sans text-xs text-red-300"
      >
        Query error: {{ typeof error === 'string' ? error : JSON.stringify(error) }}
      </div>
    </div>
  </div>
</template>
