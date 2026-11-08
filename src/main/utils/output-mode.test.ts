import { describe, expect, it } from 'vitest'
import { resolveOutputMode } from './output-mode'

describe('resolveOutputMode', () => {
  it('prefers the new outputMode setting when valid', () => {
    expect(resolveOutputMode({ outputMode: 'stacked', output: 'code', outputFilter: 'all' })).toBe('stacked')
  })

  it('falls back to the legacy mapping when the new setting is invalid', () => {
    expect(resolveOutputMode({ outputMode: 'bogus', output: 'stack', outputFilter: 'all' })).toBe('full')
  })

  it('migrates explicit + plain output to output', () => {
    expect(resolveOutputMode({ output: 'code', outputFilter: 'explicit' })).toBe('output')
  })

  it('migrates explicit + stacked output to stacked', () => {
    expect(resolveOutputMode({ output: 'stack', outputFilter: 'explicit' })).toBe('stacked')
  })

  it('migrates all + stacked output to full', () => {
    expect(resolveOutputMode({ output: 'stack', outputFilter: 'all' })).toBe('full')
  })

  it('migrates all + plain output to full', () => {
    expect(resolveOutputMode({ output: 'code', outputFilter: 'all' })).toBe('full')
  })

  it('defaults to output for legacy settings without the output filter', () => {
    expect(resolveOutputMode({ output: 'code' })).toBe('output')
    expect(resolveOutputMode({})).toBe('output')
  })
})
