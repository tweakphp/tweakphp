// Single source of truth for the bundled PHPantom language server.
// Written in plain ESM JavaScript (not TypeScript) so scripts/update-phpantom.js
// can import it directly from Node, and unit tested in phpantom-config.test.ts.
// Version is pinned here in exactly one place.
export const PHPANTOM_VERSION = '0.11.1'

export const PHPANTOM_RELEASE_BASE_URL = 'https://github.com/PHPantom-dev/phpantom_lsp/releases/download'

// electron arch -> PHPantom release asset. The release publishes one archive
// per Rust triple: .zip for windows-msvc, .tar.gz otherwise. The server binary
// sits at the archive root as `phpantom_lsp` (`.exe` on Windows).
//
// No win32-ia32 asset exists upstream, and no windows arm64 electron target is
// built, so both map to null.
const TARGETS = {
  'win32-x64': { triple: 'x86_64-pc-windows-msvc', archive: 'zip', binary: 'phpantom_lsp.exe' },
  'darwin-x64': { triple: 'x86_64-apple-darwin', archive: 'tar.gz', binary: 'phpantom_lsp' },
  'darwin-arm64': { triple: 'aarch64-apple-darwin', archive: 'tar.gz', binary: 'phpantom_lsp' },
  'linux-x64': { triple: 'x86_64-unknown-linux-gnu', archive: 'tar.gz', binary: 'phpantom_lsp' },
  'linux-arm64': { triple: 'aarch64-unknown-linux-gnu', archive: 'tar.gz', binary: 'phpantom_lsp' },
}

// Platforms whose electron builds ship PHPantom, with every arch each release
// workflow must bundle: macOS is universal (both triples), Linux builds
// x64+arm64, Windows builds x64 only.
const PLATFORM_ARCHES = {
  win32: ['x64'],
  darwin: ['x64', 'arm64'],
  linux: ['x64', 'arm64'],
}

export const phpantomTarget = (platform, arch) => {
  return TARGETS[`${platform}-${arch}`] ?? null
}

export const phpantomAssetName = (platform, arch) => {
  const target = phpantomTarget(platform, arch)
  if (!target) return null

  return `phpantom_lsp-${target.triple}.${target.archive}`
}

export const phpantomReleaseAssetUrl = (platform, arch) => {
  const assetName = phpantomAssetName(platform, arch)
  if (!assetName) return null

  return `${PHPANTOM_RELEASE_BASE_URL}/${PHPANTOM_VERSION}/${assetName}`
}

export const phpantomTargetsForPlatform = platform => {
  return (PLATFORM_ARCHES[platform] ?? []).map(arch => ({ platform, arch, ...TARGETS[`${platform}-${arch}`] }))
}
