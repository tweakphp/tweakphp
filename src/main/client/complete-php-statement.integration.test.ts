import { describe, expect, it, afterAll } from 'vitest'
import { execFileSync, spawnSync } from 'child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { completePhpStatement, normalizeForEval } from './complete-php-statement'

const hasPhp = (() => {
  try {
    execFileSync('php', ['-v'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

const phpVersion = (() => {
  if (!hasPhp) return ''
  try {
    return execFileSync('php', ['-r', 'echo PHP_MAJOR_VERSION . "." . PHP_MINOR_VERSION;'], {
      encoding: 'utf8',
    }).trim()
  } catch {
    return ''
  }
})()

// The real TweakPHP client the app actually executes code with.
const pharPath = (() => {
  if (!hasPhp) return null
  const candidate = path.resolve('public', `client-${phpVersion}.phar`)
  return existsSync(candidate) ? candidate : null
})()

const tmpDir = hasPhp ? mkdtempSync(path.join(tmpdir(), 'tweakphp-')) : ''

afterAll(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
})

// Mirrors the full Vapor flow: the IPC layer completes the code, VaporClient
// normalizes it for `eval` (stripping only a leading open tag) and completes again.
const evalLikeVapor = (code: string): string => {
  const cleaned = completePhpStatement(normalizeForEval(completePhpStatement(code)))
  const encoded = Buffer.from(cleaned).toString('base64')
  return execFileSync('php', ['-r', `eval(base64_decode('${encoded}'));`], { encoding: 'utf8' })
}

// Mirrors file-based clients: writes the code to a script and runs it.
// Like Tinker::normalizePHPCode, the `<?php` prefix is added only when the
// code does not already start with an open tag.
const runLikeFile = (code: string): string => {
  const file = path.join(tmpDir, `case-${Math.random().toString(36).slice(2)}.php`)
  const source = /^\s*<\?php(?:\s|$)/.test(code) ? code : `<?php\n${code}\n`
  writeFileSync(file, source)
  try {
    return execFileSync('php', [file], { encoding: 'utf8' })
  } finally {
    rmSync(file, { force: true })
  }
}

describe.skipIf(!hasPhp)('completePhpStatement with real PHP', () => {
  const cases: Array<[code: string, expected: string]> = [
    ["echo 'hello'", 'hello'],
    ['$a = 1; echo $a', '1'],
    ["echo 'a', 'b' // trailing comment", 'ab'],
    ["echo 'x' ?>", 'x'],
    ['echo <<<EOT\nheredoc ok\nEOT', 'heredoc ok'],
    ["$f = function () { return 'cl'; }; echo $f()", 'cl'],
    ['$a = ["//" => "ok"]; echo "{$a["//"]}";', 'ok'],
    ['$x = [<<<TXT\nhello\nTXT]; echo $x[0]', 'hello'],
    ['$a = ["//" => "ok"]; echo "{$a[/* } */ "//"]}";', 'ok'],
    ['$a = 1; // comment\recho $a', '1'],
    ['echo <<<世界\nhello\n世界', 'hello'],
    ['do { echo 1; } while (0)', '1'],
    ['if (true) echo 1', '1'],
    ['foreach ([1] as $v) echo $v', '1'],
    ['namespace Foo; echo 1', '1'],
    ['declare(ticks=1) echo 1', '1'],
    ['declare(ticks=2) echo 2', '2'],
    ['$s = "<?php "; echo $s;', '<?php '],
    ['if (true) $f = function () { return "z"; }; echo $f()', 'z'],
    ['namespace Foo; $g = function () { return "ns"; }; echo $g()', 'ns'],
    ['echo 1; ?><?php echo 2', '12'],
    ['echo new DateTimeImmutable("2000-01-01")->format("Y")', '2000'],
    ['$a = [\'} " ?>\' => "ok"]; echo "{$a[<<<TXT\n} " ?>\nTXT\n]}"', 'ok'],
  ]

  it.each(cases)('evaluates completed code in eval context (Vapor-like): %j', (code, expected) => {
    const completed = completePhpStatement(code)
    expect(evalLikeVapor(completed)).toBe(expected)
  })

  it.each(cases)('runs completed code from a file: %j', (code, expected) => {
    const completed = completePhpStatement(code)
    expect(runLikeFile(completed)).toBe(expected)
  })

  it('preserves Unicode text that begins with the nowdoc label', () => {
    const code = "$x = <<<'TXT'\nTXT世界 ?>\nTXT;\necho $x;"
    const completed = completePhpStatement(code)
    expect(completed).toBe(code)
    expect(runLikeFile(completed)).toBe('TXT世界 ?>')
    expect(execFileSync('php', ['-r', completed], { encoding: 'utf8' })).toBe('TXT世界 ?>')
  })

  it('completes code with a leading newline before the open tag', () => {
    const code = '\n<?php\necho 1'
    const completed = completePhpStatement(code)
    expect(completed).toBe('\n<?php\necho 1;')
    // Vapor strips the leading tag (with the newline before it): pure PHP output.
    expect(evalLikeVapor(completed)).toBe('1')
    // File mode keeps the leading newline as inline HTML, which is echoed.
    expect(runLikeFile(completed)).toBe('\n1')
  })

  it('preserves line numbers when normalizing for eval', () => {
    const code = '<?php\n// comment\necho __LINE__;'
    const prepared = normalizeForEval(completePhpStatement(code))
    const result = spawnSync('php', ['-d', 'display_errors=stderr', '-r', prepared], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('3')
  })

  it('keeps the implicit echo of a short echo tag when normalizing for eval', () => {
    const code = '<?= 1 ?>'
    const prepared = normalizeForEval(completePhpStatement(code))
    const result = spawnSync('php', ['-d', 'display_errors=stderr', '-r', prepared], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('1')
  })

  it('raw code without a semicolon fails in eval context, proving the completion matters', () => {
    const encoded = Buffer.from("echo 'hello'").toString('base64')
    const result = spawnSync('php', ['-r', `eval(base64_decode('${encoded}'));`], { encoding: 'utf8' })
    expect(result.status).not.toBe(0)
    expect(`${result.stdout}${result.stderr}`).toContain('Parse error')
  })

  it.skipIf(!pharPath)('keeps valid, completed code executable through the real client', () => {
    const code = 'echo "phar";'
    const stdout = execFileSync(
      'php',
      [pharPath!, tmpDir, 'execute', Buffer.from(completePhpStatement(code)).toString('base64')],
      { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 }
    )
    expect(stdout).toContain('TWEAKPHP_RESULT:')
    expect(stdout).toContain('phar')
  })

  it.skipIf(!pharPath)('executes unsemicolon-ed code through the real client (execute)', () => {
    const stdout = execFileSync(
      'php',
      [pharPath!, tmpDir, 'execute', Buffer.from(completePhpStatement('echo 1 // comment')).toString('base64')],
      { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 }
    )
    expect(stdout).toContain('TWEAKPHP_RESULT:')
    expect(stdout).toContain('"1"')
  })

  it.skipIf(!pharPath)('executes completed code through the real client (execute-stream)', () => {
    const stdout = execFileSync(
      'php',
      [pharPath!, tmpDir, 'execute-stream', Buffer.from(completePhpStatement("echo 'stream-abc';")).toString('base64')],
      { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 }
    )
    expect(stdout).toContain('stream-abc')
    expect(stdout).toContain('"type":"completed"')
  })
})
