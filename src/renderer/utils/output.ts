import type { Result } from '../../types/tab.type'

export type OutputFilter = 'all' | 'explicit'

export const joinResultOutputs = (results: Result[]): string =>
  results
    .map(result => result.output.trim())
    .filter(output => output !== '')
    .join('\n')

const explicitOutputFunctions = [
  'var_dump',
  'print_r',
  'var_export',
  'printf',
  'vprintf',
  'dump',
  'dd',
  'ray',
  'exit',
  'die',
]

const explicitOutputPattern = new RegExp(
  `\\becho\\b|\\bprint\\b|\\bfwrite\\s*\\(\\s*(?:STDOUT|STDERR)|\\b(?:${explicitOutputFunctions.join('|')})\\s*\\(`,
  'i'
)

export const isExplicitResult = (result: Result): boolean => {
  if (result.implicit === true) return false

  if (result.explicitOutput !== undefined) return result.explicitOutput !== '' || !!result.explicitHtml

  if (result.code.trim() === '') return true

  return explicitOutputPattern.test(result.code)
}

export const visibleResults = (results: Result[], filter: OutputFilter): Result[] =>
  filter === 'all'
    ? results
    : results.filter(isExplicitResult).map(result => ({
        ...result,
        output: result.explicitOutput ?? result.output,
        html: result.explicitHtml ?? result.html,
        ...(result.parts ? { parts: result.parts.filter(part => !part.implicit) } : {}),
      }))

export const stripAnsi = (value: string): string =>
  value
    .replace(/(?:ESC|\\e|\\x1b|\\u001b|\\033)\s*\[[\d;?]*[ -/]*[@-~]/gi, '')
    .replace(
      /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g,
      ''
    )

export const normalizeVaporOutput = (value: string): string => {
  const output = stripAnsi(value)
  const statusCode = output.match(/(?:^|\n)Status Code:\s*(\d+)/)?.[1]

  if (statusCode && statusCode !== '0') return output

  const outputMarker = output.match(/(?:^|\n)Output:\s*/)
  if (!outputMarker || outputMarker.index === undefined) return output

  const outputStart = outputMarker.index + outputMarker[0].length
  const metadata = output
    .slice(outputStart)
    .search(/(?:^|\n)\s*(?:Vapor Command ID|AWS Request ID|AWS Log Group Name|AWS Log Stream Name):/)
  const result = output.slice(outputStart, metadata === -1 ? undefined : outputStart + metadata).trim()

  return result || 'No output.'
}
