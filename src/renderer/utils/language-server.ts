// WSL UNC paths (`\\wsl$...`, `\\wsl.localhost...`, also seen with forward
// slashes) are served through the WSL 9P filesystem bridge where the language
// server's file watching and indexing misbehave. The LSP is disabled for those
// paths only — not for Windows as a whole.
export const isWslWorkspacePath = (workspacePath: string | undefined): boolean =>
  /^[\\/]{2}wsl(\.localhost|\$)[\\/]/i.test(workspacePath ?? '')

export const intelephenseStoragePath = (tempDir: string, workspacePath: string): string =>
  `${tempDir.replace(/[\\/]+$/, '')}/tweakphp-intelephense-${encodeURIComponent(workspacePath || '')}`

export const buildIntelephenseInitializationOptions = (options: {
  workspacePath: string
  tempDir: string
  licenseKey?: string
}) => ({
  storagePath: intelephenseStoragePath(options.tempDir, options.workspacePath),
  licenceKey: options.licenseKey || undefined,
  environment: options.workspacePath,
  clearCache: true,
  files: {
    maxSize: 100_000_000,
    exclude: [
      '**/.git/**',
      '**/CVS/**',
      '**/.DS_Store/**',
      '**/node_modules/**',
      '**/vendor/**/{Tests,tests}/**',
      '**/vendor/**/vendor/**',
    ],
  },
})
