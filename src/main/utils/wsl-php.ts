import { execSync } from 'child_process'

const COMMON_WSL_PHP_LOCATIONS = [
  '~/.local/share/lerd/bin/php',
  '~/.config/herd-lite/bin/php',
  '~/.local/share/mise/shims/php',
  '~/.asdf/shims/php',
  '/home/linuxbrew/.linuxbrew/bin/php',
  '/usr/local/bin/php',
  '/usr/bin/php',
]

const WSL_PROBE_TIMEOUT_MS = 1500
const resolvedWslPhpCache = new Map<string, string>()

const parseWslPaths = (raw: unknown): string[] => {
  if (typeof raw !== 'string' || !raw.trim()) {
    return []
  }

  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('/') && !line.includes('not found'))
}

const runWslProbe = (command: string): string[] => {
  try {
    const out = execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: WSL_PROBE_TIMEOUT_MS,
    })
    return parseWslPaths(out)
  } catch {
    return []
  }
}

/**
 * Discovers PHP executables inside a WSL distro, checking standard PATH first
 * and falling back to common user-space managers (Lerd, Herd Lite, mise, asdf,
 * Linuxbrew) and interactive login shells.
 */
export const detectWslPhpPathsInDistro = (distro: string): string[] => {
  const paths = new Set<string>()

  for (const p of runWslProbe(`wsl -d ${distro} which php`)) {
    paths.add(p)
  }

  const locations = COMMON_WSL_PHP_LOCATIONS.join(' ')
  for (const p of runWslProbe(
    `wsl -d ${distro} --exec sh -c "for p in ${locations}; do test -x \\"$p\\" && echo \\"$p\\"; done; true"`
  )) {
    paths.add(p)
  }

  if (paths.size === 0) {
    for (const p of runWslProbe(
      `wsl -d ${distro} --exec sh -c "\${SHELL:-sh} -ic 'command -v php' 2>/dev/null; true"`
    )) {
      paths.add(p)
    }
  }

  return Array.from(paths)
}

/**
 * Resolves the Linux PHP executable inside a WSL distro when no WSL-specific
 * PHP path was configured, caching the discovered path for the session.
 */
export const resolveWslPhpBinary = (distro: string): string => {
  const cached = resolvedWslPhpCache.get(distro)
  if (cached) {
    return cached
  }

  const detected = detectWslPhpPathsInDistro(distro)
  if (detected.length > 0) {
    resolvedWslPhpCache.set(distro, detected[0])
    return detected[0]
  }

  return 'php'
}

export const clearWslPhpCache = (): void => {
  resolvedWslPhpCache.clear()
}
