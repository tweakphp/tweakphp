import { Result } from '../types/tab.type'

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const TWEAKPHP_ERROR_MARKER = 'TWEAKPHP_ERROR:'

const parseLine = (value: unknown): number => {
  // Non-numeric lines must not become NaN (it would corrupt `dump-${line}`
  // element ids in StackedOutput)
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

export const parseTweakPhpError = (raw: unknown): Result => {
  let parsedError: any = raw
  let errorContent = typeof raw === 'string' ? raw : ''

  if (typeof raw === 'string' && raw !== '') {
    // Slice after the marker instead of split()[1]: if the marker appears
    // more than once in the message, split would truncate at the second one
    const markerIndex = raw.indexOf(TWEAKPHP_ERROR_MARKER)
    errorContent = markerIndex !== -1 ? raw.slice(markerIndex + TWEAKPHP_ERROR_MARKER.length).trim() : raw
    try {
      parsedError = JSON.parse(errorContent)
    } catch (e) {
      parsedError = errorContent
    }
  }

  let message = ''
  let line = 0

  if (typeof parsedError === 'object' && parsedError !== null) {
    const errorClass = parsedError.class || ''
    const errorMsg = parsedError.message || ''
    message =
      errorClass && errorMsg ? `${errorClass}: ${errorMsg}` : errorMsg || errorClass || JSON.stringify(parsedError)

    if (parsedError.line) {
      line = parseLine(parsedError.line)
    } else {
      const lineMatch = message.match(/on line (\d+)/i) || errorContent.match(/on line (\d+)/i)
      if (lineMatch) {
        line = parseInt(lineMatch[1], 10)
      }
    }
  } else {
    // Never render the literal "undefined"/"null" for falsy inputs
    message = parsedError === null || parsedError === undefined ? errorContent : String(parsedError)
    const lineMatch = message.match(/on line (\d+)/i)
    if (lineMatch) {
      line = parseInt(lineMatch[1], 10)
    }
  }

  const escapedMessage = escapeHtml(message)

  return {
    line,
    code: '',
    output: message,
    html: `<div class="text-red-500 font-semibold">${escapedMessage}</div>`,
  }
}
