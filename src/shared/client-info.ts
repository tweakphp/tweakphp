const tryParseObject = (text: string): Record<string, any> | null => {
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, any>
    }
  } catch {
    // Ignore invalid JSON fragments
  }
  return null
}

const findMatchingBraceEnd = (input: string, start: number): number => {
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < input.length; i++) {
    const ch = input[i]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
    } else if (ch === '{') {
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) {
        return i
      }
    }
  }

  return -1
}

/**
 * Parses the JSON object returned by the TweakPHP client `info` command.
 * PHP CLI may emit notices or deprecation warnings before or after the JSON
 * payload when `display_errors` is enabled, so this extracts the valid JSON
 * object even when non-JSON output surrounds it.
 */
export function parseClientInfoJson(raw: unknown): Record<string, any> | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, any>
  }

  if (typeof raw !== 'string') {
    return null
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const direct = tryParseObject(trimmed)
  if (direct) {
    return direct
  }

  let fallback: Record<string, any> | null = null
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] !== '{') {
      continue
    }

    const end = findMatchingBraceEnd(trimmed, i)
    if (end === -1) {
      continue
    }

    const parsed = tryParseObject(trimmed.slice(i, end + 1))
    if (!parsed) {
      continue
    }

    if ('php_version' in parsed || 'version' in parsed || 'name' in parsed) {
      return parsed
    }

    fallback = parsed
    i = end
  }

  return fallback
}
