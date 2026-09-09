import { describe, it, expect } from 'vitest'
import { parseExecutionResult } from './execution-result'

describe('parseExecutionResult (execution-result.ts)', () => {
  it('parses TWEAKPHP_RESULT JSON payload', () => {
    const parsed = parseExecutionResult('Some output\nTWEAKPHP_RESULT:{"val": 42}\n')

    expect(parsed.isError).toBe(false)
    expect(parsed.output).toEqual({ val: 42 })
    expect(parsed.error).toBeUndefined()
  })

  it('returns the raw payload string when TWEAKPHP_RESULT is not valid JSON', () => {
    const parsed = parseExecutionResult('TWEAKPHP_RESULT:not-json-payload\n')

    expect(parsed.isError).toBe(false)
    expect(parsed.output).toBe('not-json-payload')
  })

  it('returns the trimmed raw output when no marker is present', () => {
    const parsed = parseExecutionResult('Raw output\n')

    expect(parsed.isError).toBe(false)
    expect(parsed.output).toBe('Raw output')
  })

  it('falls back to the trimmed raw output when the result payload is empty', () => {
    const parsed = parseExecutionResult('TWEAKPHP_RESULT:\n')

    expect(parsed.isError).toBe(false)
    expect(parsed.output).toBe('TWEAKPHP_RESULT:')
  })

  it('parses TWEAKPHP_ERROR JSON payload into a structured error', () => {
    const parsed = parseExecutionResult(
      'TWEAKPHP_ERROR:{"class":"ParseError","message":"syntax error, unexpected end of file","line":3}\n'
    )

    expect(parsed.isError).toBe(true)
    expect(parsed.error).toEqual({
      line: 3,
      code: '',
      output: 'ParseError: syntax error, unexpected end of file',
      html: '<div class="text-red-500 font-semibold">ParseError: syntax error, unexpected end of file</div>',
    })
    expect(parsed.output).toEqual([parsed.error])
  })

  it('parses TWEAKPHP_ERROR plain-text payload', () => {
    const parsed = parseExecutionResult('TWEAKPHP_ERROR:PHP Fatal error: something bad on line 7\n')

    expect(parsed.isError).toBe(true)
    expect(parsed.error?.output).toBe('PHP Fatal error: something bad on line 7')
    expect(parsed.error?.line).toBe(7)
  })

  it('handles empty or whitespace-only output', () => {
    const parsed = parseExecutionResult('   \n')

    expect(parsed.isError).toBe(false)
    expect(parsed.output).toBe('')
  })
})
