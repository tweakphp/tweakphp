import { describe, it, expect } from 'vitest'
import { buildPosixStopScript, buildWindowsStopScript, clientStopPattern } from './stop-command'

describe('clientStopPattern', () => {
  it('uses the phar basename of the connection', () => {
    expect(clientStopPattern('/home/u/.tweakphp/client-8.3.phar')).toBe('client-8.3.phar')
    expect(clientStopPattern('C:\\app\\public\\client-7.4.phar')).toBe('client-7.4.phar')
    expect(clientStopPattern('/tmp/client.phar')).toBe('client.phar')
  })

  it('falls back to a generic client match without a known path', () => {
    expect(clientStopPattern(undefined)).toBe('client')
    expect(clientStopPattern('   ')).toBe('client')
  })
})

describe('buildPosixStopScript', () => {
  it('verifies the pid against /proc cmdline before killing', () => {
    const script = buildPosixStopScript(4321, 'client-8.3.phar', 'TERM')

    expect(script.startsWith('if [ -r /proc/4321/cmdline ]')).toBe(true)
    expect(script).toContain("grep -q -- 'client-8.3.phar' /proc/4321/cmdline")
    expect(script).toContain('kill -TERM 4321')
  })

  it('falls back to ps when /proc is unavailable (macOS)', () => {
    const script = buildPosixStopScript(4321, 'client-8.3.phar')

    expect(script).toContain("ps -p 4321 -o command= 2>/dev/null | grep -q -- 'client-8.3.phar'")
    expect(script).toContain('kill -TERM 4321')
  })

  it('escapes the pattern for the shell', () => {
    const script = buildPosixStopScript(7, "it's.phar", 'KILL')

    expect(script).toContain("'it'\\''s.phar'")
    expect(script).toContain('kill -KILL 7')
  })

  it('defaults to SIGTERM', () => {
    expect(buildPosixStopScript(9, 'client.phar')).toContain('kill -TERM 9')
  })
})

describe('buildWindowsStopScript', () => {
  it('checks the command line via CIM, then force-kills the whole tree', () => {
    const script = buildWindowsStopScript(4321, 'client-8.3.phar')

    expect(script).toContain('Get-CimInstance Win32_Process -Filter "ProcessId=4321"')
    expect(script).toContain("-match 'client-8\\.3\\.phar'")
    expect(script).toContain('taskkill /PID 4321 /T /F')
    expect(script).toContain('else { exit 1 }')
  })
})
