/**
 * Convert an arbitrary IPC error payload (string, Error, plain object, …)
 * into a human readable message: `alert(error)` on a serialized object would
 * print "[object Object]".
 */
export const errorMessage = (error: unknown): string => {
  if (error === null || error === undefined) {
    return ''
  }
  if (typeof error === 'string') {
    return error
  }
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}
