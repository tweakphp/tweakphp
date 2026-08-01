export type StreamEvent = { type: string; [key: string]: unknown }

export const createStreamOutputParser = (onEvent?: (event: StreamEvent) => void) => {
  let buffer = ''

  const parseLine = (line: string) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('TWEAKPHP_STREAM:')) {
      const rawJson = trimmed.substring('TWEAKPHP_STREAM:'.length)
      try {
        onEvent?.(JSON.parse(rawJson))
      } catch {}
      return
    }

    if (trimmed.startsWith('TWEAKPHP_ERROR:')) {
      const errorJson = trimmed.substring('TWEAKPHP_ERROR:'.length)
      try {
        onEvent?.({ type: 'error', error: JSON.parse(errorJson) })
      } catch {
        onEvent?.({ type: 'error', error: errorJson })
      }
    }
  }

  return {
    push(chunk: string) {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      lines.forEach(parseLine)
    },
    finish() {
      if (buffer) parseLine(buffer)
      buffer = ''
    },
  }
}
