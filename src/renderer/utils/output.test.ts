import { describe, expect, it } from 'vitest'
import type { Result } from '../../types/tab.type'
import { joinResultOutputs, normalizeVaporOutput } from './output'

const result = (output: string): Result => ({
  line: 1,
  code: '',
  output,
  html: '',
})

describe('joinResultOutputs', () => {
  it('joins all non-empty outputs in order', () => {
    expect(joinResultOutputs([result('a'), result('b')])).toBe('a\nb')
  })

  it('skips empty outputs', () => {
    expect(joinResultOutputs([result('a'), result(''), result('2')])).toBe('a\n2')
  })

  it('returns a single output as is, without extra newlines', () => {
    expect(joinResultOutputs([result('2')])).toBe('2')
  })

  it('trims outputs before joining', () => {
    expect(joinResultOutputs([result('a\n')])).toBe('a')
  })

  it('keeps multi-line outputs intact', () => {
    expect(joinResultOutputs([result('dump(\'x\')\n"x"\n'), result('b')])).toBe('dump(\'x\')\n"x"\nb')
  })

  it('returns an empty string when there are no outputs', () => {
    expect(joinResultOutputs([])).toBe('')
  })

  it('returns an empty string when all outputs are empty', () => {
    expect(joinResultOutputs([result(''), result(' \n ')])).toBe('')
  })
})

describe('normalizeVaporOutput', () => {
  it('keeps only the actual output and removes Vapor metadata', () => {
    const value = `==> Executing Function...\n\nStatus Code: 0\n\nOutput:\nhello\n\nVapor Command ID: 123\nAWS Request ID: abc`

    expect(normalizeVaporOutput(value)).toBe('hello')
  })

  it('shows a placeholder when Vapor returns no output', () => {
    const value = `Status Code: 0\n\nOutput:\n\nVapor Command ID: 123`

    expect(normalizeVaporOutput(value)).toBe('No output.')
  })

  it('keeps the complete response when the command fails', () => {
    const value = `Status Code: 1\n\nOutput:\nSomething failed\nVapor Command ID: 123`

    expect(normalizeVaporOutput(value)).toBe(value)
  })
})
