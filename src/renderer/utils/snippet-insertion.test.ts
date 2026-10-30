import { describe, expect, it } from 'vitest'
import { normalizedSnippetLength } from './snippet-insertion'

describe('snippet insertion offsets', () => {
  it.each([
    ['LF into CRLF', 'A\nB\nC', '\r\n', 7],
    ['CRLF into LF', 'A\r\nB\r\nC', '\n', 5],
    ['mixed endings into LF', 'A\rB\r\nC\nD', '\n', 7],
    ['unchanged CRLF', 'A\r\nB', '\r\n', 4],
  ])('%s', (_label, text, eol, length) => {
    expect(normalizedSnippetLength(text, eol)).toBe(length)
  })

  it.each([
    ['start\r\nend', 'A\nB\nC'],
    ['start\nend', 'A\r\nB\r\nC'],
  ])('lands at the actual end in a Monaco text buffer', async (document, snippet) => {
    const bufferPath = 'vscode/vscode/vs/editor/common/model/pieceTreeTextBuffer/pieceTreeTextBufferBuilder'
    const rangePath = 'vscode/vscode/vs/editor/common/core/range'
    const { PieceTreeTextBufferBuilder } = await import(/* @vite-ignore */ bufferPath)
    const { Range } = await import(/* @vite-ignore */ rangePath)
    const builder = new PieceTreeTextBufferBuilder()
    builder.acceptChunk(document)
    const { textBuffer } = builder.finish().create(1)
    const offset = textBuffer.getOffsetAt(2, 1)
    textBuffer.applyEdits([{ range: new Range(2, 1, 2, 1), text: snippet }], false, false)
    const position = textBuffer.getPositionAt(offset + normalizedSnippetLength(snippet, textBuffer.getEOL()))
    expect({ lineNumber: position.lineNumber, column: position.column }).toEqual({ lineNumber: 4, column: 2 })
    textBuffer.dispose()
  })
})
