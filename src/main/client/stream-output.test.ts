import { describe, expect, it } from 'vitest'
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

  it('reports streamed output only after protocol events were delivered', () => {
    const parser = createStreamOutputParser(() => {})

    expect(parser.hasStreamOutput()).toBe(false)

    parser.push('plain output without protocol markers\n')

    expect(parser.hasStreamOutput()).toBe(false)

    parser.push('TWEAKPHP_STREAM:{"type":"output","index":0,"data":"first"}\n')

    expect(parser.hasStreamOutput()).toBe(true)
  })

  it('reports streamed output while a protocol line is still buffered', () => {
    const parser = createStreamOutputParser(() => {})

    parser.push('TWEAKPHP_STREAM:{"type":"outp')

    expect(parser.hasStreamOutput()).toBe(true)
  })

  it('does not report streamed output for malformed protocol lines', () => {
    const parser = createStreamOutputParser(() => {})

    parser.push('TWEAKPHP_STREAM:not-json\n')

    expect(parser.hasStreamOutput()).toBe(false)
  })
})
