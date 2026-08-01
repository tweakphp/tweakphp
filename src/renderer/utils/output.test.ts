import { describe, expect, it } from 'vitest'
import { normalizeVaporOutput } from './output'

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
