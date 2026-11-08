import { describe, expect, it } from 'vitest'
import {
  PHPANTOM_VERSION,
  phpantomAssetName,
  phpantomReleaseAssetUrl,
  phpantomTarget,
  phpantomTargetsForPlatform,
} from './phpantom-config.js'

describe('phpantomTarget', () => {
  it.each([
    ['win32', 'x64', 'x86_64-pc-windows-msvc'],
    ['darwin', 'x64', 'x86_64-apple-darwin'],
    ['darwin', 'arm64', 'aarch64-apple-darwin'],
    ['linux', 'x64', 'x86_64-unknown-linux-gnu'],
    ['linux', 'arm64', 'aarch64-unknown-linux-gnu'],
  ])('maps %s/%s to %s', (platform, arch, triple) => {
    expect(phpantomTarget(platform, arch)?.triple).toBe(triple)
  })

  it('has no mapping for windows ia32 (no upstream asset) and unknown combos', () => {
    expect(phpantomTarget('win32', 'ia32')).toBeNull()
    expect(phpantomTarget('win32', 'arm64')).toBeNull()
    expect(phpantomTarget('freebsd', 'x64')).toBeNull()
    expect(phpantomTarget('darwin', 'ppc64')).toBeNull()
  })

  it('returns the windows binary with an .exe extension and plain binary elsewhere', () => {
    expect(phpantomTarget('win32', 'x64')?.binary).toBe('phpantom_lsp.exe')
    expect(phpantomTarget('darwin', 'arm64')?.binary).toBe('phpantom_lsp')
    expect(phpantomTarget('linux', 'x64')?.binary).toBe('phpantom_lsp')
  })

  it('ships .zip archives for windows and .tar.gz archives elsewhere', () => {
    expect(phpantomTarget('win32', 'x64')?.archive).toBe('zip')
    expect(phpantomTarget('darwin', 'arm64')?.archive).toBe('tar.gz')
    expect(phpantomTarget('linux', 'x64')?.archive).toBe('tar.gz')
  })
})

describe('phpantomAssetName', () => {
  it.each([
    ['win32', 'x64', `phpantom_lsp-x86_64-pc-windows-msvc.zip`],
    ['darwin', 'x64', `phpantom_lsp-x86_64-apple-darwin.tar.gz`],
    ['darwin', 'arm64', `phpantom_lsp-aarch64-apple-darwin.tar.gz`],
    ['linux', 'x64', `phpantom_lsp-x86_64-unknown-linux-gnu.tar.gz`],
    ['linux', 'arm64', `phpantom_lsp-aarch64-unknown-linux-gnu.tar.gz`],
  ])('names the release asset for %s/%s', (platform, arch, expected) => {
    expect(phpantomAssetName(platform, arch)).toBe(expected)
  })

  it('returns null for unsupported combos', () => {
    expect(phpantomAssetName('win32', 'ia32')).toBeNull()
    expect(phpantomAssetName('sunos', 'x64')).toBeNull()
  })
})

describe('phpantomReleaseAssetUrl', () => {
  it('points at the pinned release tag', () => {
    expect(PHPANTOM_VERSION).toBe('0.11.1')

    expect(phpantomReleaseAssetUrl('linux', 'x64')).toBe(
      `https://github.com/PHPantom-dev/phpantom_lsp/releases/download/${PHPANTOM_VERSION}/phpantom_lsp-x86_64-unknown-linux-gnu.tar.gz`
    )
  })

  it('returns null for unsupported combos', () => {
    expect(phpantomReleaseAssetUrl('win32', 'ia32')).toBeNull()
  })
})

describe('phpantomTargetsForPlatform', () => {
  it('lists both darwin triples for universal mac builds', () => {
    const triples = phpantomTargetsForPlatform('darwin').map(target => target.triple)

    expect(triples).toEqual(['x86_64-apple-darwin', 'aarch64-apple-darwin'])
  })

  it('lists both linux triples for the x64+arm64 linux targets', () => {
    const triples = phpantomTargetsForPlatform('linux').map(target => target.triple)

    expect(triples).toEqual(['x86_64-unknown-linux-gnu', 'aarch64-unknown-linux-gnu'])
  })

  it('lists only x64 for windows (ia32 is not supported upstream)', () => {
    const targets = phpantomTargetsForPlatform('win32')

    expect(targets.map(target => target.triple)).toEqual(['x86_64-pc-windows-msvc'])
    expect(targets[0].binary).toBe('phpantom_lsp.exe')
  })

  it('returns an empty list for unknown platforms', () => {
    expect(phpantomTargetsForPlatform('freebsd')).toEqual([])
  })
})
