import { describe, expect, it } from 'vitest'
import type { Result } from '../../types/tab.type'
import { isExplicitResult, joinResultOutputs, normalizeVaporOutput, visibleResults } from './output'

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

describe('isExplicitResult', () => {
  const codedResult = (code: string, output = 'x'): Result => ({
    line: 1,
    code,
    output,
    html: '',
  })

  it('marks echo statements as explicit', () => {
    expect(isExplicitResult(codedResult(`echo "hello";`))).toBe(true)
  })

  it('marks print statements as explicit', () => {
    expect(isExplicitResult(codedResult(`print "hello";`))).toBe(true)
  })

  it('marks print_r calls as explicit', () => {
    expect(isExplicitResult(codedResult(`print_r($x)`))).toBe(true)
  })

  it('marks echo nested in control structures as explicit', () => {
    expect(isExplicitResult(codedResult(`if ($x) { echo 'a'; }`))).toBe(true)
  })

  it('marks var_dump, dump, dd and printf calls as explicit', () => {
    expect(isExplicitResult(codedResult(`var_dump($x)`))).toBe(true)
    expect(isExplicitResult(codedResult(`dump($demo)`))).toBe(true)
    expect(isExplicitResult(codedResult(`dd($demo)`))).toBe(true)
    expect(isExplicitResult(codedResult(`printf('%d', $x)`))).toBe(true)
  })

  it('marks fwrite to STDOUT as explicit', () => {
    expect(isExplicitResult(codedResult(`fwrite(STDOUT, 'hi')`))).toBe(true)
  })

  it('marks assignments and plain expressions as implicit', () => {
    expect(isExplicitResult(codedResult(`$demo = User::first()`))).toBe(false)
    expect(isExplicitResult(codedResult(`User::first()`))).toBe(false)
    expect(isExplicitResult(codedResult(`$x = 1 + 1`))).toBe(false)
  })

  it('does not confuse print with printf or print_r when no call follows', () => {
    expect(isExplicitResult(codedResult(`$printer = 'x'`))).toBe(false)
  })

  it('hides results flagged implicit by the client', () => {
    expect(isExplicitResult({ ...codedResult(`dump($demo)`), implicit: true })).toBe(false)
  })

  it('always shows results without a statement code, such as errors', () => {
    expect(isExplicitResult(codedResult('', 'ErrorException: Table not found'))).toBe(true)
    expect(isExplicitResult({ ...codedResult(''), implicit: true })).toBe(false)
  })
})

describe('visibleResults', () => {
  const echo = (code: string, output = 'x'): Result => ({
    line: 1,
    code,
    output,
    html: '',
  })

  it('keeps every result when the filter is all', () => {
    const results = [echo(`$demo = User::first()`, 'User {#1}'), echo(`echo "hi";`, 'hi')]

    expect(visibleResults(results, 'all')).toHaveLength(2)
  })

  it('keeps only explicit results when the filter is explicit', () => {
    const implicit = echo(`$demo = User::first()`, 'User {#1}')
    const explicit = echo(`dump($demo)`, 'User {#1}')

    expect(visibleResults([implicit, explicit], 'explicit')).toEqual([explicit])
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
