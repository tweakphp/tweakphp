/**
 * Accent palette behind the app-wide `primary` Tailwind color.
 *
 * The `primary` scale is wired to `--color-primary-*` CSS variables (see
 * tailwind.config.js) so the accent can follow the selected editor theme.
 * Shades 300–700 cover every `primary-*` class currently in use.
 */
type PrimaryPalette = Record<300 | 400 | 500 | 600 | 700, string>

const themePrimaryPalettes: Record<string, PrimaryPalette> = {
  'dracula': {
    300: '#dbc4fc',
    400: '#ceaefa',
    500: '#bd93f9',
    600: '#8e6ebb',
    700: '#685189',
  },
  'nord': {
    300: '#bedce5',
    400: '#a6d0dc',
    500: '#88c0d0',
    600: '#66909c',
    700: '#4b6a72',
  },
  'monokai': {
    300: '#ceef8c',
    400: '#bce962',
    500: '#a6e22e',
    600: '#6c931e',
    700: '#4b6615',
  },
  'github-light': {
    300: '#8ebaed',
    400: '#4f94e2',
    500: '#0366d6',
    600: '#0252ab',
    700: '#023d80',
  },
  'catppuccin': {
    300: '#e2caf1',
    400: '#d7b6ec',
    500: '#ca9ee6',
    600: '#9876ac',
    700: '#6f577e',
  },
  'night-owl': {
    300: '#e0c3f3',
    400: '#d5adef',
    500: '#c792ea',
    600: '#956eb0',
    700: '#6d5081',
  },
  'rose-pine': {
    300: '#f4b0c3',
    400: '#f093ad',
    500: '#eb6f92',
    600: '#b0536e',
    700: '#813d50',
  },
  'ultra-dark': {
    300: '#b3c7fb',
    400: '#96b4f9',
    500: '#7aa2f7',
    600: '#5678b6',
    700: '#3f5884',
  },
}

const defaultTheme = 'dracula'

// Converts "#rrggbb" (or "#rgb") into the space separated "r g b" channels
// required by the `rgb(var(--color-primary-*) / <alpha-value>)` pattern.
export const hexToRgbChannels = (hex: string): string => {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map(char => char + char)
          .join('')
      : value
  const int = parseInt(full, 16)
  return `${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255}`
}

export const primaryPaletteForTheme = (theme: string): PrimaryPalette => {
  return themePrimaryPalettes[theme] ?? themePrimaryPalettes[defaultTheme]
}

// Writes the `--color-primary-*` variables for the given theme on the root
// element so every `primary-*` Tailwind class picks the accent up instantly.
// No-ops outside a DOM environment (e.g. unit tests) unless a root is given.
export const applyPrimaryColors = (theme: string, root?: HTMLElement): void => {
  if (!root) {
    if (typeof document === 'undefined') return
    root = document.documentElement
  }
  const palette = primaryPaletteForTheme(theme)
  for (const [shade, hex] of Object.entries(palette)) {
    root.style.setProperty(`--color-primary-${shade}`, hexToRgbChannels(hex))
  }
}
