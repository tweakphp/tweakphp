import { describe, expect, it } from 'vitest'
import { parseClientInfoJson } from './client-info'

describe('parseClientInfoJson', () => {
  it('parses clean JSON output', () => {
    const raw = JSON.stringify({ name: 'Laravel', version: '11.57.1', php_version: '8.4.1' })
    expect(parseClientInfoJson(raw)).toEqual({
      name: 'Laravel',
      version: '11.57.1',
      php_version: '8.4.1',
    })
  })

  it('extracts JSON when PHP deprecation notices precede it', () => {
    const raw =
      'Deprecated: Implicitly marking parameter $app as nullable is deprecated in /var/www/vendor/foo.php on line 42' +
      '{"name":"Laravel","version":"11.57.1","php_version":"8.4.1"}'

    expect(parseClientInfoJson(raw)).toEqual({
      name: 'Laravel',
      version: '11.57.1',
      php_version: '8.4.1',
    })
  })

  it('handles stray quotes or braces inside preceding warnings and trailing output', () => {
    const raw =
      'Deprecated: "unclosed quote and {stray brace in /path/file.php\n' +
      '{"name":"Symfony","version":"7.1.0","php_version":"8.3.12"}\n' +
      'Warning: trailing notice'

    expect(parseClientInfoJson(raw)).toEqual({
      name: 'Symfony',
      version: '7.1.0',
      php_version: '8.3.12',
    })
  })

  it('returns null when output contains no JSON object', () => {
    expect(parseClientInfoJson('PHP 8.3\n')).toBeNull()
    expect(parseClientInfoJson('')).toBeNull()
    expect(parseClientInfoJson(undefined)).toBeNull()
  })
})
