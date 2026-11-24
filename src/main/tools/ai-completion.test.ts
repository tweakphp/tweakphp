import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { AiCompletion } from './ai-completion'
import fetch from 'node-fetch'
import { getSettings } from '../settings'

vi.mock('node-fetch', () => ({
  default: vi.fn(),
}))

vi.mock('../settings', () => ({
  getSettings: vi.fn(),
  settingsDir: '/tmp',
}))

vi.mock('electron', () => ({
  app: { getVersion: () => '0.14.0' },
  shell: { openExternal: vi.fn() },
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

  describe('Copilot provider', () => {
    const completionContext = {
      completionMetadata: {
        language: 'php',
        textBeforeCursor: 'echo 1;',
        textAfterCursor: '\necho 2;',
        cursorPosition: { lineNumber: 1, column: 8 },
      },
    }

    const makeCopilotAuth = (overrides: Record<string, unknown> = {}) =>
      ({
        getStatus: () => ({ signedIn: true }),
        getCopilotToken: async () => ({
          token: 'copilot-token',
          apiEndpoint: 'https://api.test',
          expiresAt: 9999999999,
        }),
        getCompletionsEndpoint: () => 'https://proxy.test',
        getSessionId: () => 'session-id',
        getMachineId: () => 'machine-id',
        invalidateCopilotToken: vi.fn(),
        ...overrides,
      }) as any

    /**
     * Builds a mock streaming response that emits the given chunks once the
     * completion code has attached its listeners.
     */
    const streamResponse = (chunks: string[], status = 200) => {
      const body = new EventEmitter()
      const response = { status, statusText: 'OK', body }
      setImmediate(() => {
        for (const chunk of chunks) {
          body.emit('data', Buffer.from(chunk))
        }
        body.emit('end')
      })
      return response
    }

    it('returns error when not signed in', async () => {
      vi.mocked(getSettings).mockReturnValue({
        aiProvider: 'copilot',
      } as any)

      const completer = new AiCompletion(makeCopilotAuth({ getStatus: () => ({ signedIn: false }) }))
      const result = await completer.getCompletions(completionContext, { info: {} } as any)

      expect(result.completion).toBeNull()
      expect(result.error).toBe('Sign in to GitHub Copilot from Settings to use autocomplete.')
    })

    it('does not require an API key', async () => {
      vi.mocked(getSettings).mockReturnValue({
        aiApiKey: null,
        aiProvider: 'copilot',
      } as any)

      const completer = new AiCompletion(makeCopilotAuth())
      const result = await completer.getCompletions(completionContext, { info: {} } as any)

      expect(result.error).not.toBe('API key is not set.')
    })

    it('calls the copilot completions proxy with prefix and suffix', async () => {
      vi.mocked(getSettings).mockReturnValue({
        aiProvider: 'copilot',
      } as any)

      vi.mocked(fetch).mockResolvedValue(
        streamResponse([
          'data: {"choices":[{"text":" com"}]}\n\n',
          'data: {"choices":[{"text":"pleted"}]}\n\n',
          'data: [DONE]\n\n',
        ]) as any
      )

      const completer = new AiCompletion(makeCopilotAuth())
      const result = await completer.getCompletions(completionContext, { info: {} } as any)

      expect(result.completion).toBe(' completed')
      expect(result.error).toBeNull()
      expect(fetch).toHaveBeenCalledWith(
        'https://proxy.test/v1/engines/copilot-codex/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer copilot-token',
            'OpenAI-Intent': 'copilot-ghost',
          }),
        })
      )

      const body = JSON.parse((fetch as any).mock.calls[0][1].body)
      expect(body.prompt).toBe('echo 1;')
      expect(body.suffix).toBe('\necho 2;')
      expect(body.stream).toBe(true)
      expect(body.extra.language).toBe('php')
    })

    it('reassembles SSE chunks split across buffer boundaries', async () => {
      vi.mocked(getSettings).mockReturnValue({
        aiProvider: 'copilot',
      } as any)

      vi.mocked(fetch).mockResolvedValue(
        streamResponse(['data: {"choices":[{"text":" he', 'llo"}]}\n\ndata: [DO', 'NE]\n\n']) as any
      )

      const completer = new AiCompletion(makeCopilotAuth())
      const result = await completer.getCompletions(completionContext, { info: {} } as any)

      expect(result.completion).toBe(' hello')
      expect(result.error).toBeNull()
    })

    it('refreshes the copilot token and retries once on 401', async () => {
      vi.mocked(getSettings).mockReturnValue({
        aiProvider: 'copilot',
      } as any)

      vi.mocked(fetch)
        .mockResolvedValueOnce({ status: 401, statusText: 'Unauthorized' } as any)
        .mockResolvedValueOnce(
          streamResponse(['data: {"choices":[{"text":" retried"}]}\n\n', 'data: [DONE]\n\n']) as any
        )

      const auth = makeCopilotAuth()
      const completer = new AiCompletion(auth)
      const result = await completer.getCompletions(completionContext, { info: {} } as any)

      expect(result.completion).toBe(' retried')
      expect(result.error).toBeNull()
      expect(auth.invalidateCopilotToken).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('returns error on copilot API failure', async () => {
      vi.mocked(getSettings).mockReturnValue({
        aiProvider: 'copilot',
      } as any)

      const mockResponse = {
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'No subscription',
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const completer = new AiCompletion(makeCopilotAuth())
      const result = await completer.getCompletions(completionContext, { info: {} } as any)

      expect(result.completion).toBeNull()
      expect(result.error).toContain('Copilot API error: 403')
    })
  })
})
