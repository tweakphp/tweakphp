<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useTabsStore } from '../stores/tabs'
  import { useSettingsStore } from '../stores/settings'
  import { QueryItem, Result } from '../../types/tab.type'
  import { MagnifyingGlassIcon, ClipboardDocumentIcon, CheckIcon, CircleStackIcon } from '@heroicons/vue/24/outline'

  type StatementGroup = {
    result: Result | null
    index: number
    queries: QueryItem[]
  }

  const tabStore = useTabsStore()
  const settingsStore = useSettingsStore()
  const searchQuery = ref('')
  const copiedIndex = ref<string | null>(null)

  const statementGroups = computed<StatementGroup[]>(() => {
    const currentTab = tabStore.getCurrent()
    const results = currentTab?.result ?? []
    const groups = results.map((result, index) => ({
      result,
      index,
      queries: Array.isArray(result.queries) ? (result.queries as QueryItem[]) : [],
    }))

    // Keep displaying queries saved by older tabs that have no per-result data.
    if (groups.some(group => group.queries.length > 0) || !currentTab?.queries?.length) {
      return groups.filter(group => group.queries.length > 0)
    }

    return [{ result: null, index: 0, queries: currentTab.queries }]
  })

  const queries = computed<QueryItem[]>(() => statementGroups.value.flatMap(group => group.queries))

  function getSql(item: QueryItem): string {
    if (typeof item === 'string') return item
    return item.sql || item.query || item.raw_sql || item.statement || ''
  }

  function getTimeNumber(item: QueryItem): number {
    if (typeof item === 'string') return 0
    const rawTime = item.time ?? item.duration ?? item.execution_time
    if (rawTime === undefined || rawTime === null) return 0
    const parsed = typeof rawTime === 'string' ? parseFloat(rawTime) : rawTime
    return isNaN(parsed) ? 0 : parsed
  }

  function formatTime(item: QueryItem): string {
    const num = getTimeNumber(item)
    if (num === 0) return ''
    if (num < 1) return `${(num * 1000).toFixed(2)} μs`
    return `${num.toFixed(2)} ms`
  }

  function getTimeBadgeClass(item: QueryItem): string {
    const num = getTimeNumber(item)
    if (num > 50) return 'bg-red-500/10 text-red-400 border-red-500/20'
    if (num > 10) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  }

  function interpolateSql(item: QueryItem): string {
    const sql = getSql(item)
    if (typeof item === 'string') return sql
    const bindings = item.bindings
    if (!sql) return ''
    if (!bindings || !Array.isArray(bindings) || bindings.length === 0) return sql

    let index = 0
    return sql.replace(/\?/g, () => {
      if (index >= bindings.length) return '?'
      const val = bindings[index++]
      if (val === null || val === undefined) return 'NULL'
      if (typeof val === 'boolean') return val ? '1' : '0'
      if (typeof val === 'number') return String(val)
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
      return `'${JSON.stringify(val)}'`
    })
  }

  function queryMatches(item: QueryItem, query: string): boolean {
    const queryItem = item as QueryItem | string
    if (typeof queryItem === 'string') return queryItem.toLowerCase().includes(query)
    const rawSql = getSql(item).toLowerCase()
    const interpSql = interpolateSql(item).toLowerCase()
    const connStr = (item.connection || item.connection_name || '').toLowerCase()
    const bindingsStr = (item.bindings || [])
      .map(binding => String(binding))
      .join(' ')
      .toLowerCase()

    return rawSql.includes(query) || interpSql.includes(query) || connStr.includes(query) || bindingsStr.includes(query)
  }

  const filteredGroups = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    if (!query) return statementGroups.value

    return statementGroups.value
      .map(group => {
        const codeMatches = group.result?.code?.toLowerCase().includes(query)
        const matchingQueries = codeMatches ? group.queries : group.queries.filter(item => queryMatches(item, query))
        return { ...group, queries: matchingQueries }
      })
      .filter(group => group.queries.length > 0 || group.result?.code?.toLowerCase().includes(query))
  })

  const totalTime = computed(() => queries.value.reduce((acc, query) => acc + getTimeNumber(query), 0))

  function escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function highlightSql(item: QueryItem): string {
    const sql = interpolateSql(item)
    if (!sql) return ''
    const escaped = escapeHtml(sql)
    const keywords = [
      'SELECT',
      'FROM',
      'WHERE',
      'AND',
      'OR',
      'INSERT',
      'INTO',
      'UPDATE',
      'DELETE',
      'JOIN',
      'LEFT JOIN',
      'RIGHT JOIN',
      'INNER JOIN',
      'OUTER JOIN',
      'CROSS JOIN',
      'ON',
      'GROUP BY',
      'ORDER BY',
      'LIMIT',
      'OFFSET',
      'HAVING',
      'AS',
      'IN',
      'IS',
      'NULL',
      'NOT',
      'EXISTS',
      'LIKE',
      'BETWEEN',
      'SET',
      'VALUES',
      'CREATE',
      'TABLE',
      'DROP',
      'ALTER',
      'ASC',
      'DESC',
    ]

    const regex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi')
    return escaped.replace(regex, '<span class="text-pink-400 font-semibold">$1</span>')
  }

  function getErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error
    if (error && typeof error === 'object') {
      const value = error as Record<string, unknown>
      return String(value.message || value.error || JSON.stringify(error))
    }
    return String(error)
  }

  const copyQuery = (item: QueryItem, key: string) => {
    navigator.clipboard.writeText(interpolateSql(item))
    copiedIndex.value = key
    setTimeout(() => {
      if (copiedIndex.value === key) copiedIndex.value = null
    }, 2000)
  }
</script>

<template>
  <div class="flex flex-col space-y-4 max-h-[70vh] overflow-hidden">
    <div
      class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b"
      :style="{ borderColor: settingsStore.colors.border }"
    >
      <div class="flex items-center space-x-3 text-xs">
        <div class="px-2.5 py-1 rounded-md border font-medium bg-blue-500/10 text-blue-400 border-blue-500/20">
          Total Queries: <span class="font-bold">{{ queries.length }}</span>
        </div>
        <div
          v-if="queries.length > 0"
          class="px-2.5 py-1 rounded-md border font-medium bg-purple-500/10 text-purple-400 border-purple-500/20"
        >
          Total Time: <span class="font-bold">{{ totalTime.toFixed(2) }} ms</span>
        </div>
      </div>

      <div v-if="queries.length > 0" class="flex items-center flex-1 max-w-sm">
        <div class="relative w-full">
          <MagnifyingGlassIcon
            class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search queries or parameters..."
            class="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border bg-transparent outline-none focus:outline-none focus:border-primary-500 transition-colors"
            :style="{
              borderColor: settingsStore.colors.border,
              backgroundColor: settingsStore.colors.backgroundLight,
              color: settingsStore.colors.foreground,
            }"
          />
        </div>
      </div>
    </div>

    <div
      v-if="queries.length === 0"
      class="flex flex-col items-center justify-center py-12 text-center text-gray-400 space-y-3"
    >
      <CircleStackIcon class="w-12 h-12 stroke-1 text-gray-500" />
      <div class="text-sm font-medium">No queries executed</div>
      <div class="text-xs max-w-sm text-gray-500">Run PHP code that performs database queries to view them here.</div>
    </div>

    <div v-else-if="filteredGroups.length === 0" class="py-8 text-center text-xs text-gray-400">
      No queries matching "<span class="text-gray-200">{{ searchQuery }}</span
      >"
    </div>

    <div v-else class="space-y-4 overflow-y-auto pr-2 custom-scrollbar max-h-[55vh]">
      <section
        v-for="group in filteredGroups"
        :key="`statement-${group.index}`"
        class="relative pl-4 border-l-2 border-blue-500/30 space-y-2"
      >
        <div
          v-for="(item, queryIndex) in group.queries"
          :key="`${group.index}-query-${queryIndex}`"
          class="rounded-lg border p-3 font-mono text-xs relative group"
          :style="{
            backgroundColor: settingsStore.colors.backgroundLight,
            borderColor: settingsStore.colors.border,
          }"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center space-x-2">
              <span
                v-if="group.result"
                class="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-gray-500/20 text-gray-300"
              >
                Line {{ group.result.line }}
              </span>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-gray-500/20 text-gray-300">
                Query {{ queryIndex + 1 }}
              </span>
              <span
                v-if="typeof item !== 'string' && (item.connection || item.connection_name)"
                class="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-blue-500/20 text-blue-300"
              >
                {{ item.connection || item.connection_name }}
              </span>
            </div>

            <div class="flex items-center space-x-2">
              <span
                v-if="formatTime(item)"
                class="text-[10px] px-2 py-0.5 rounded-full border font-semibold"
                :class="getTimeBadgeClass(item)"
              >
                {{ formatTime(item) }}
              </span>
              <button
                @click="copyQuery(item, `${group.index}-${queryIndex}`)"
                class="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                v-tippy="{ content: 'Copy query', placement: 'top' }"
              >
                <CheckIcon v-if="copiedIndex === `${group.index}-${queryIndex}`" class="w-3.5 h-3.5 text-green-400" />
                <ClipboardDocumentIcon v-else class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div
            class="bg-black/30 p-2.5 rounded border border-white/5 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed text-gray-200"
          >
            <span v-html="highlightSql(item)"></span>
          </div>

          <div
            v-if="typeof item !== 'string' && item.bindings && Array.isArray(item.bindings) && item.bindings.length > 0"
            class="mt-2 text-[11px] text-gray-400 flex items-center gap-1.5 flex-wrap"
          >
            <span class="text-gray-500 font-sans text-[10px]">Bindings:</span>
            <span
              v-for="(binding, bindingIndex) in item.bindings"
              :key="bindingIndex"
              class="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 font-mono text-[10px]"
            >
              {{ binding === null ? 'null' : String(binding) }}
            </span>
          </div>
        </div>

        <div
          v-for="(error, errorIndex) in group.result?.query_errors || []"
          :key="`${group.index}-error-${errorIndex}`"
          class="rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          Query error: {{ getErrorMessage(error) }}
        </div>
      </section>
    </div>
  </div>
</template>
