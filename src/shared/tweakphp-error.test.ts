import { describe, it, expect } from 'vitest'
import { parseTweakPhpError } from './tweakphp-error'

describe('parseTweakPhpError (tweakphp-error.ts)', () => {
  it('parses JSON error payload with class, message and line', () => {
    const raw = 'TWEAKPHP_ERROR:{"class":"ParseError","message":"syntax error, unexpected end of file","line":3}'

    const result = parseTweakPhpError(raw)

    expect(result.line).toBe(3)
    expect(result.code).toBe('')
    expect(result.output).toBe('ParseError: syntax error, unexpected end of file')
    expect(result.html).toBe(
      '<div class="text-red-500 font-semibold">ParseError: syntax error, unexpected end of file</div>'
    )
  })

  it('extracts line from message when JSON payload has no line field', () => {
    const raw = 'TWEAKPHP_ERROR:{"message":"Call to undefined function foo() on line 12"}'

    const result = parseTweakPhpError(raw)

    expect(result.output).toBe('Call to undefined function foo() on line 12')
    expect(result.line).toBe(12)
  })

  it('handles plain-text error payload and extracts line via regex', () => {
    const raw = 'TWEAKPHP_ERROR:PHP Fatal error: something bad on line 7'

    const result = parseTweakPhpError(raw)

    expect(result.output).toBe('PHP Fatal error: something bad on line 7')
    expect(result.line).toBe(7)
    expect(result.html).toBe('<div class="text-red-500 font-semibold">PHP Fatal error: something bad on line 7</div>')
  })

  it('escapes HTML-sensitive characters in the html output', () => {
    const raw = `TWEAKPHP_ERROR:{"message":"<b>Tom & \\"Jerry\\"</b> 'quoted'"}`

    const result = parseTweakPhpError(raw)

    expect(result.output).toBe(`<b>Tom & "Jerry"</b> 'quoted'`)
    expect(result.html).toBe(
      '<div class="text-red-500 font-semibold">&lt;b&gt;Tom &amp; &quot;Jerry&quot;&lt;/b&gt; &#039;quoted&#039;</div>'
    )
  })

  it('parses an already parsed streaming error object', () => {
    const result = parseTweakPhpError({
      class: 'RuntimeException',
      message: 'Something failed on line 9',
    })

    expect(result.output).toBe('RuntimeException: Something failed on line 9')
    expect(result.line).toBe(9)
    expect(result.html).toBe(
      '<div class="text-red-500 font-semibold">RuntimeException: Something failed on line 9</div>'
    )
  })

  it('falls back to raw input when TWEAKPHP_ERROR marker is missing', () => {
    const raw = 'Some unexpected raw output'

    const result = parseTweakPhpError(raw)

    expect(result.output).toBe('Some unexpected raw output')
    expect(result.line).toBe(0)
  })
})
