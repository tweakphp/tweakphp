import { describe, expect, it, vi } from 'vitest'
import { createStreamOutputParser } from './stream-output'

describe('createStreamOutputParser', () => {
  it('parses split stream records and a final record without a newline', () => {
    const events: any[] = []
    const parser = createStreamOutputParser(event => events.push(event))

    parser.push('TWEAKPHP_STR')
    parser.push('EAM:{"type":"output","index":0,"data":"first"}\n')
    parser.push('TWEAKPHP_ERROR:{"message":"second"}')
    parser.finish()

    expect(events).toEqual([
      { type: 'output', index: 0, data: 'first' },
      { type: 'error', error: { message: 'second' } },
    ])
  })

  it('logs invalid TWEAKPHP_STREAM JSON payloads instead of swallowing them', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const events: any[] = []
    const parser = createStreamOutputParser(event => events.push(event))

    parser.push('TWEAKPHP_STREAM:not-json\n')
    parser.finish()

    expect(events).toEqual([])
    expect(consoleError).toHaveBeenCalledWith('Failed to parse stream event:', expect.any(Error), 'not-json')
    consoleError.mockRestore()
  })
})
