import { LanguageServer } from '../../types/settings.type'

// WSL UNC paths (`\\wsl$...`, `\\wsl.localhost...`, also seen with forward
// slashes) are served through the WSL 9P filesystem bridge where the language
// server's file watching and indexing misbehave. The LSP is disabled for those
// paths only — not for Windows as a whole.
export const isWslWorkspacePath = (workspacePath: string | undefined): boolean =>
  /^[\\/]{2}wsl(\.localhost|\$)[\\/]/i.test(workspacePath ?? '')

const DEFAULT_EXCLUDED_FILES = [
  '**/.git/**',
  '**/CVS/**',
  '**/.DS_Store/**',
  '**/node_modules/**',
  '**/vendor/**/{Tests,tests}/**',
  '**/vendor/**/vendor/**',
]

export const intelephenseStoragePath = (tempDir: string, workspacePath: string): string =>
  `${tempDir.replace(/[\\/]+$/, '')}/tweakphp-intelephense-${encodeURIComponent(workspacePath || '')}`

export interface IntelephenseInitializationOptions {
  storagePath: string
  licenceKey?: string
  environment: string
  clearCache: boolean
  files: {
    maxSize: number
    exclude: string[]
  }
}

export interface PhpantomInitializationOptions {
  indexing: {
    exclude: string[]
  }
}

export type LanguageServerInitializationOptions = IntelephenseInitializationOptions | PhpantomInitializationOptions

export const buildIntelephenseInitializationOptions = (options: {
  workspacePath: string
  tempDir: string
  licenseKey?: string
}): IntelephenseInitializationOptions => ({
  storagePath: intelephenseStoragePath(options.tempDir, options.workspacePath),
  licenceKey: options.licenseKey || undefined,
  environment: options.workspacePath,
  clearCache: true,
  files: {
    maxSize: 100_000_000,
    exclude: [...DEFAULT_EXCLUDED_FILES],
  },
})

// PHPantom requires no initializationOptions; mirror the excluded files as
// gitignore-style patterns, which merge with the project's own .phpantom.toml.
export const buildPhpantomInitializationOptions = (): PhpantomInitializationOptions => ({
  indexing: {
    exclude: [...DEFAULT_EXCLUDED_FILES],
  },
})

export const buildLanguageServerInitializationOptions = (options: {
  languageServer: LanguageServer
  workspacePath: string
  tempDir: string
  intelephenseLicenseKey?: string
}): LanguageServerInitializationOptions =>
  options.languageServer === 'phpantom'
    ? buildPhpantomInitializationOptions()
    : buildIntelephenseInitializationOptions({
        workspacePath: options.workspacePath,
        tempDir: options.tempDir,
        licenseKey: options.intelephenseLicenseKey,
      })
