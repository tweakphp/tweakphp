import { QueryItem } from '../types/tab.type'

/**
 * Shared query-log helpers: previously duplicated between StackedOutput.vue
 * and QueriesView.vue with subtly different behavior (e.g. formatTime treating
 * 0 ms differently).
 */
export const getQuerySql = (item: QueryItem): string => {
  if (typeof item === 'string') return item
  return item.sql || item.query || item.raw_sql || item.statement || ''
}

export const interpolateSql = (item: QueryItem): string => {
  const sql = getQuerySql(item)
  if (typeof item === 'string') return sql
  if (!Array.isArray(item.bindings) || item.bindings.length === 0) return sql

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

export const getQueryTime = (item: QueryItem): number => {
  if (typeof item === 'string') return 0
  const rawTime = item.time ?? item.duration ?? item.execution_time
  if (rawTime === undefined || rawTime === null) return 0
  const parsed = typeof rawTime === 'string' ? parseFloat(rawTime) : rawTime
  return isNaN(parsed) ? 0 : parsed
}

export const formatQueryTime = (item: QueryItem): string => {
  const time = getQueryTime(item)
  if (time === 0) return ''
  return time < 1 ? `${(time * 1000).toFixed(2)} μs` : `${time.toFixed(2)} ms`
}
