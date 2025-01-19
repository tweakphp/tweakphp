export const isLinux = () => {
  return process.platform === 'linux'
}

export const isMacOS = () => {
  return process.platform === 'darwin'
}

export const isWindows = () => {
  return process.platform === 'win32'
}
