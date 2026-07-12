import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AiCompletion } from './ai-completion'
import fetch from 'node-fetch'
import { getSettings } from '../settings'

vi.mock('node-fetch', () => ({
  default: vi.fn(),
}))

vi.mock('../settings', () => ({
  getSettings: vi.fn(),
}))

describe('AiCompletion', () => {
  let consoleLogSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  it('returns error if api key is missing', async () => {
    vi.mocked(getSettings).mockReturnValue({
      aiApiKey: '',
    } as any)

    const completer = new AiCompletion()
    const result = await completer.getCompletions(
      {
        completionMetadata: {
          language: 'php',
          textBeforeCursor: '',
          textAfterCursor: '',
          cursorPosition: { lineNumber: 1, column: 1 },
        },
      },
      { info: { name: 'Laravel', version: '10' } } as any
    )

    expect(result.completion).toBeNull()
    expect(result.error).toBe('API key is not set.')
  })

  it('returns error if openrouter model is missing', async () => {
    vi.mocked(getSettings).mockReturnValue({
      aiApiKey: 'test-key',
      aiProvider: 'openrouter',
      aiModelId: '',
    } as any)

    const completer = new AiCompletion()
    const result = await completer.getCompletions(
      {
        completionMetadata: {
          language: 'php',
          textBeforeCursor: '',
          textAfterCursor: '',
          cursorPosition: { lineNumber: 1, column: 1 },
        },
      },
      { info: { name: 'Laravel', version: '10' } } as any
    )

    expect(result.completion).toBeNull()
    expect(result.error).toBe('AI model ID is not set for OpenRouter.')
  })

  it('returns error if provider is unsupported', async () => {
    vi.mocked(getSettings).mockReturnValue({
      aiApiKey: 'test-key',
      aiProvider: 'unsupported',
    } as any)

    const completer = new AiCompletion()
    const result = await completer.getCompletions(
      {
        completionMetadata: {
          language: 'php',
          textBeforeCursor: '',
          textAfterCursor: '',
          cursorPosition: { lineNumber: 1, column: 1 },
        },
      },
      { info: { name: 'Laravel', version: '10' } } as any
    )

    expect(result.completion).toBeNull()
    expect(result.error).toBe('Unsupported AI provider.')
  })

  it('calls fetchOpenRouter successfully', async () => {
    vi.mocked(getSettings).mockReturnValue({
      aiApiKey: 'test-key',
      aiProvider: 'openrouter',
      aiModelId: 'test-model',
    } as any)

    const mockResponse = {
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'completed code',
            },
          },
        ],
      }),
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    const completer = new AiCompletion()
    const result = await completer.getCompletions(
      {
        completionMetadata: {
          language: 'php',
          textBeforeCursor: 'echo 1;',
          textAfterCursor: 'echo 2;',
          cursorPosition: { lineNumber: 1, column: 8 },
        },
      },
      { info: { name: 'Laravel', version: '10', php_version: '8.2' } } as any
    )

    expect(result.completion).toBe('completed code')
    expect(result.error).toBeNull()
    expect(fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    )
  })

  it('returns error on OpenRouter API non-200 status', async () => {
    vi.mocked(getSettings).mockReturnValue({
      aiApiKey: 'test-key',
      aiProvider: 'openrouter',
      aiModelId: 'test-model',
    } as any)

    const mockResponse = {
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'Invalid payload',
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    const completer = new AiCompletion()
    const result = await completer.getCompletions(
      {
        completionMetadata: {
          language: 'php',
          textBeforeCursor: '',
          textAfterCursor: '',
          cursorPosition: { lineNumber: 1, column: 1 },
        },
      },
      { info: {} } as any
    )

    expect(result.completion).toBeNull()
    expect(result.error).toContain('OpenRouter API error: 400')
  })

  describe('Scenario Detection (isCommentToCodeScenario & isInsideComment)', () => {
    it('detects comment to code scenario for line comments', () => {
      const completer = new AiCompletion()
      const context = {
        language: 'php',
        textBeforeCursor: '// comment explaining what to do\n',
        textAfterCursor: '',
        cursorPosition: { lineNumber: 2, column: 1 },
      }
      const isCommentToCode = (completer as any).isCommentToCodeScenario(context)
      expect(isCommentToCode).toBe(true)
    })

    it('detects inside multiline comment scenario', () => {
      const completer = new AiCompletion()
      const context = {
        language: 'php',
        textBeforeCursor: '/* this is inside a comment block ',
        textAfterCursor: ' */',
        cursorPosition: { lineNumber: 1, column: 35 },
      }
      const isInside = (completer as any).isInsideComment(context)
      expect(isInside).toBe(true)
    })

    it('detects inside singleline comment scenario', () => {
      const completer = new AiCompletion()
      const context = {
        language: 'php',
        textBeforeCursor: 'echo 1; // inline comment ',
        textAfterCursor: '',
        cursorPosition: { lineNumber: 1, column: 27 },
      }
      const isInside = (completer as any).isInsideComment(context)
      expect(isInside).toBe(true)
    })

    it('identifies standard code completion scenario', () => {
      const completer = new AiCompletion()
      const context = {
        language: 'php',
        textBeforeCursor: 'echo 1;',
        textAfterCursor: '',
        cursorPosition: { lineNumber: 1, column: 8 },
      }
      expect((completer as any).isCommentToCodeScenario(context)).toBe(false)
      expect((completer as any).isInsideComment(context)).toBe(false)
    })
  })
})
