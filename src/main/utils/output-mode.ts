import { OutputMode } from '../../types/settings.type'

export const resolveOutputMode = (settingsJson: Record<string, any>): OutputMode => {
  if (
    settingsJson.outputMode === 'output' ||
    settingsJson.outputMode === 'stacked' ||
    settingsJson.outputMode === 'full'
  ) {
    return settingsJson.outputMode
  }

  if (settingsJson.output === 'stack') {
    return settingsJson.outputFilter === 'all' ? 'full' : 'stacked'
  }

  return settingsJson.outputFilter === 'all' ? 'full' : 'output'
}
