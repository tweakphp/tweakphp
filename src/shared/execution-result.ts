import { Result } from '../types/tab.type'
import { parseTweakPhpError } from './tweakphp-error'

export const TWEAKPHP_RESULT_MARKER = 'TWEAKPHP_RESULT:'
export const TWEAKPHP_ERROR_MARKER = 'TWEAKPHP_ERROR:'

export interface ParsedExecutionResult {
  /**
   * Parsed output payload:
   * - JSON value when the raw output carries `TWEAKPHP_RESULT` (falls back to the
   *   raw payload string when it is not valid JSON)
   * - array of structured error results when the output carries `TWEAKPHP_ERROR`
   * - otherwise the trimmed raw output
   */
  output: unknown
  /** True when the raw output carries a `TWEAKPHP_ERROR` marker */
  isError: boolean
  /** Structured error parsed from `TWEAKPHP_ERROR` (only set when isError is true) */
  error?: Result
}

/**
 * Parse the output of a TweakPHP client execution.
 *
 * Shared by the client IPC handler and the MCP execute tools so all callers
 * agree on the result/error envelope produced by the phar client.
 */
export const parseExecutionResult = (raw: string): ParsedExecutionResult => {
  const trimmed = (raw ?? '').trim()

  if (trimmed.includes(TWEAKPHP_ERROR_MARKER)) {
    const error = parseTweakPhpError(trimmed)
    return { output: [error], isError: true, error }
  }

  if (trimmed.includes(TWEAKPHP_RESULT_MARKER)) {
    const outputStr = trimmed.split(TWEAKPHP_RESULT_MARKER)[1]?.trim()
    if (outputStr !== undefined && outputStr !== '') {
      try {
        return { output: JSON.parse(outputStr), isError: false }
      } catch {
        return { output: outputStr, isError: false }
      }
    }
  }

  return { output: trimmed, isError: false }
}
