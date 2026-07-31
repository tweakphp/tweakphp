interface MigrationPayload {
  connections: Record<string, unknown>[]
  tabs: Record<string, unknown>[]
  loaders: Record<string, unknown>[]
}

const legacyStorageKeys = ['ssh-connections', 'kubectl-connections', 'vapor-connections', 'tabs', 'loaders']

const readArray = (key: string): unknown[] => {
  const raw = localStorage.getItem(key)
  if (!raw) return []

  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value : []
  } catch (error) {
    console.warn(`Failed to parse legacy localStorage key "${key}":`, error)
    return []
  }
}

const recordsOnly = (items: unknown[]): Record<string, unknown>[] => {
  return items.filter((item): item is Record<string, unknown> => {
    return typeof item === 'object' && item !== null && !Array.isArray(item)
  })
}

export async function runLocalStorageMigration(): Promise<void> {
  try {
    const status = (await window.ipcRenderer.invoke('storage:migration:check')) as { migrated?: boolean } | undefined

    if (status?.migrated) {
      return
    }

    const payload: MigrationPayload = {
      connections: [
        ...recordsOnly(readArray('ssh-connections')).map(connection => ({ ...connection, type: 'ssh' })),
        ...recordsOnly(readArray('kubectl-connections')).map(connection => ({ ...connection, type: 'kubectl' })),
        ...recordsOnly(readArray('vapor-connections')).map(connection => ({ ...connection, type: 'vapor' })),
      ],
      tabs: recordsOnly(readArray('tabs')),
      loaders: recordsOnly(readArray('loaders')),
    }

    const result = (await window.ipcRenderer.invoke('storage:migration:import', payload)) as
      { success?: boolean } | undefined

    if (!result?.success) {
      throw new Error('Storage migration import was not successful')
    }

    for (const key of legacyStorageKeys) {
      localStorage.removeItem(key)
    }

    console.log('Successfully migrated legacy localStorage data to SQLite database!')
  } catch (error) {
    console.error('Failed to run localStorage migration:', error)
  }
}
