import { describe, expect, it } from 'vitest'
import { applyPrimaryColors, hexToRgbChannels, primaryPaletteForTheme } from './theme-primary-colors'

describe('primary colors', () => {
  it('converts hex colors to space separated rgb channels', () => {
    expect(hexToRgbChannels('#bd93f9')).toBe('189 147 249')
    expect(hexToRgbChannels('#0366d6')).toBe('3 102 214')
    expect(hexToRgbChannels('#abc')).toBe('170 187 204')
  })

  it('returns the palette of the selected theme', () => {
    expect(primaryPaletteForTheme('rose-pine')[500]).toBe('#eb6f92')
    expect(primaryPaletteForTheme('github-light')[500]).toBe('#0366d6')
    expect(Object.keys(primaryPaletteForTheme('dracula'))).toEqual(['300', '400', '500', '600', '700'])
  })

  it('falls back to the default palette for unknown themes', () => {
    expect(primaryPaletteForTheme('unknown')).toEqual(primaryPaletteForTheme('dracula'))
  })

  it('applies the palette as css variables on the root element', () => {
    const properties: Record<string, string> = {}
    const root = {
      style: {
        setProperty: (name: string, value: string) => {
          properties[name] = value
        },
      },
    } as unknown as HTMLElement

    applyPrimaryColors('dracula', root)
    expect(Object.keys(properties)).toHaveLength(5)
    expect(properties['--color-primary-500']).toBe('189 147 249')
    expect(properties['--color-primary-700']).toBe('104 81 137')

    applyPrimaryColors('nord', root)
    expect(properties['--color-primary-500']).toBe('136 192 208')
  })
})
