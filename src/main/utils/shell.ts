export const quotePosixShellArg = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`

export const buildPosixCommand = (command: string, args: readonly string[]): string =>
  [command, ...args].map(quotePosixShellArg).join(' ')
