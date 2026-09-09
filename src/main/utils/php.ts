export const MIN_PHP_VERSION = 7.4

/**
 * Throw when the given PHP version is lower than the minimum supported one.
 * Shared by the remote and Docker client setup flows.
 */
export const assertMinPhpVersion = (version: string | null | undefined): void => {
  if (parseFloat(version ?? '') < MIN_PHP_VERSION) {
    throw new Error(`PHP version must be ${MIN_PHP_VERSION} or higher`)
  }
}
