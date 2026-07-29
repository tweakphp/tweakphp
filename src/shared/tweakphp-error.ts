import { Result } from '../types/tab.type'

export const parseTweakPhpError = (raw: unknown): Result => {
  let parsedError: any = raw
  let errorContent = typeof raw === 'string' ? raw : ''

  if (typeof raw === 'string') {
    errorContent = raw.split('TWEAKPHP_ERROR:')[1]?.trim() || raw
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
      line = Number(parsedError.line)
    } else {
      const lineMatch = message.match(/on line (\d+)/i) || errorContent.match(/on line (\d+)/i)
      if (lineMatch) {
        line = parseInt(lineMatch[1], 10)
      }
    }
  } else {
    message = String(parsedError || errorContent || raw)
    const lineMatch = message.match(/on line (\d+)/i)
    if (lineMatch) {
      line = parseInt(lineMatch[1], 10)
    }
  }

  const escapedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  return {
    line,
    code: '',
    output: message,
    html: `<div class="text-red-500 font-semibold">${escapedMessage}</div>`,
  }
}
