import * as phpParser from 'php-parser'

// The package exports the Engine class directly (CommonJS); handle the
// different interop shapes produced by bundlers.
const Engine: any = (phpParser as any).default ?? phpParser

// Newest PHP grammar the library supports (property hooks, pipe operator...).
const PARSER_VERSION = 805

// Leading open tag: PHP files (and the TweakPHP client) accept whitespace and
// newlines before it, unlike plain `eval`.
const OPEN_TAG_PATTERN = /^\s*<\?(?:php\b|=)/i

const IGNORABLE_TOKENS = new Set(['T_WHITESPACE', 'T_COMMENT', 'T_DOC_COMMENT'])
// Tokens that never carry statements: tags and literal HTML output.
const NON_STATEMENT_TOKENS = new Set(['T_OPEN_TAG', 'T_OPEN_TAG_WITH_ECHO', 'T_CLOSE_TAG', 'T_INLINE_HTML'])

const tokenEngine = new Engine({
  parser: { suppressErrors: false, version: PARSER_VERSION },
  ast: { withPositions: true },
  lexer: { all_tokens: true, comment_tokens: true },
})

/**
 * Strict validation for the `eval` context every client executes code in:
 * unlike PHP files, `eval` requires expression statements to be terminated
 * with `;` also at the end of the input. The library is lenient about that
 * (like file parsing), so the end-of-file case is turned into an error.
 */
const strictEngine = new Engine({
  parser: { suppressErrors: false, version: PARSER_VERSION },
  ast: { withPositions: true },
})
const strictParser = strictEngine.parser as any
const expectEndOfStatement = strictParser.expectEndOfStatement.bind(strictParser)
strictParser.expectEndOfStatement = function (this: any, node: any) {
  if (this.token === this.EOF) {
    this.error(';')
    return false
  }
  return expectEndOfStatement(node)
}

type Token = string | string[]

const tokenContent = (token: Token): string => (Array.isArray(token) ? token[1] : token)
const tokenName = (token: Token): string => (Array.isArray(token) ? String(token[0]) : token)

const tokenize = (code: string): { tokens: Token[]; prefixLength: number } => {
  const prefixLength = OPEN_TAG_PATTERN.test(code) ? 0 : '<?php '.length
  const tokens = tokenEngine.tokenGetAll((prefixLength > 0 ? '<?php ' : '') + code) as Token[]
  return { tokens, prefixLength }
}

/**
 * Offset where a missing semicolon must be inserted (end of the last PHP
 * statement token), or null when there is nothing to complete.
 */
const findInsertion = (code: string): number | null => {
  const { tokens, prefixLength } = tokenize(code)
  let offset = 0
  let meaningfulEnd = 0
  let meaningfulIsSemicolon = false
  let haveMeaningful = false

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    const name = tokenName(token)
    const content = tokenContent(token)
    const start = offset
    offset += content.length

    if (index === 0 && prefixLength > 0) continue // synthetic open tag
    if (name === 'T_HALT_COMPILER') return null // never touch the trailing data section
    if (IGNORABLE_TOKENS.has(name)) {
      // An unterminated block comment is a parse error in PHP, and the
      // library tolerates it: nothing to complete.
      const trimmed = content.trimStart()
      if (trimmed.startsWith('/*') && !content.includes('*/')) return null
      continue
    }
    if (NON_STATEMENT_TOKENS.has(name)) continue

    haveMeaningful = true
    meaningfulEnd = start + content.length - prefixLength
    meaningfulIsSemicolon = name === ';'
  }

  if (!haveMeaningful || meaningfulIsSemicolon) return null
  return meaningfulEnd
}

const strictParse = (code: string): boolean => {
  try {
    strictEngine.parseEval(code.replace(OPEN_TAG_PATTERN, ''))
    return true
  } catch {
    return false
  }
}

/**
 * True when the code contains `declare (...)` followed by a statement without
 * braces. That construct is valid PHP, but the library grammar cannot parse
 * it, so the semicolon for its last statement must be validated differently.
 */
const hasUnsupportedDeclare = (code: string): boolean => {
  const { tokens, prefixLength } = tokenize(code)
  let depth = 0
  let sawDeclare = false
  let closed = false

  for (let index = 0; index < tokens.length; index++) {
    const name = tokenName(tokens[index])
    if (index === 0 && prefixLength > 0) continue // synthetic open tag
    if (IGNORABLE_TOKENS.has(name)) continue
    if (name === 'T_DECLARE') {
      sawDeclare = true
      continue
    }
    if (!sawDeclare) continue
    if (name === '(' && !closed) {
      depth++
      continue
    }
    if (name === ')' && !closed) {
      depth--
      if (depth === 0) closed = true
      continue
    }
    if (closed) {
      if (name === ';' || name === '{') return false // supported construct
      return true // statement after the directives: unsupported by the grammar
    }
  }
  return false
}

/**
 * Validate a `declare (...) ...;` candidate by translating it to the
 * grammatically equivalent `if (true) { ... }`, which the library supports.
 */
const validateDeclareCandidate = (candidate: string): boolean => {
  const match = candidate.match(/^[\s]*declare\s*\(([^()]*)\)([\s\S]*)$/)
  if (!match) return false
  const body = match[2].trimEnd()
  if (!body.endsWith(';') && !body.endsWith('}')) return false
  return strictParse(`if (true) {${body}}`)
}

/**
 * Add a terminator to the last PHP statement without changing the editor contents.
 *
 * Contract: valid code is returned untouched, at most one `;` is appended after
 * the last statement token, and anything that does not parse (incomplete or
 * unsupported syntax) is returned unchanged.
 */
export function completePhpStatement(code: string): string {
  try {
    if (strictParse(code)) return code
    const at = findInsertion(code)
    if (at === null) return code
    const result = `${code.slice(0, at)};${code.slice(at)}`
    if (strictParse(result)) return result
    // The library grammar cannot parse `declare (...) stmt`: validate the
    // candidate through the equivalent `if (true) { ... }` construct instead.
    if (hasUnsupportedDeclare(code) && validateDeclareCandidate(result)) return result
    return code
  } catch {
    return code
  }
}

/**
 * Make code safe for `eval`: `eval` rejects a leading open tag, so deal with
 * that one only. Closing tags, tag reopenings and the HTML between them stay
 * in place: they carry semantics (implicit `;`, output, line numbers) that
 * must not be destroyed by removing them.
 *
 * - `<?php` / `<?PHP`: removed. Whitespace and newlines around it are kept,
 *   so line numbers stay intact.
 * - `<?=`: replaced with `echo ` (same length) to preserve the implicit echo
 *   and every line offset.
 */
export function normalizeForEval(code: string): string {
  try {
    const { tokens, prefixLength } = tokenize(code)
    let output = ''
    let offset = 0
    let handled = false
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index]
      const content = tokenContent(token)
      const start = offset
      offset += content.length
      const name = tokenName(token)
      if (index === 0 && prefixLength > 0) continue // synthetic open tag

      // Only the leading open tag is normalized, and only when the input
      // really starts with one (no synthetic prefix): a `<?php` in the middle
      // of the code is a tag reopening that must stay in place.
      if (!handled && prefixLength === 0 && (name === 'T_OPEN_TAG' || name === 'T_OPEN_TAG_WITH_ECHO')) {
        handled = true
        if (name === 'T_OPEN_TAG') {
          // Keep the whitespace/newline the lexer includes inside the tag
          // token, so line numbers of everything after it stay intact.
          output += content.replace(/^<\?php/i, '')
          continue
        }
        // `<?=` carries an implicit echo; the lexer may or may not include
        // the separator space in the token, so add one only when needed.
        const nextContent = index + 1 < tokens.length ? tokenContent(tokens[index + 1]) : ''
        output += /^\s/.test(nextContent) ? 'echo' : 'echo '
        continue
      }

      // Token offsets are in prefixed coordinates: map them back to the code.
      output += code.slice(start - prefixLength, offset - prefixLength)
    }
    return output
  } catch {
    return code
  }
}
