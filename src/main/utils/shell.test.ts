import { describe, expect, it } from 'vitest'
import { buildPosixCommand, quotePosixShellArg } from './shell'

describe('POSIX shell quoting', () => {
  it('keeps spaces, quotes, and shell metacharacters inside one argument', () => {
    expect(quotePosixShellArg("/app dir/$(touch nope); it's safe")).toBe("'/app dir/$(touch nope); it'\\''s safe'")
  })

  it('serializes every command word safely', () => {
    expect(buildPosixCommand('php', ['/path with spaces/client.phar', '/app; echo unsafe', 'execute'])).toBe(
      "'php' '/path with spaces/client.phar' '/app; echo unsafe' 'execute'"
    )
  })
})
