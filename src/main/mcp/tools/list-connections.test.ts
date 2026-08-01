import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.13.3',
    getPath: () => '/tmp',
  },
}))

import { ListConnectionsHandler } from './list-connections'

describe('ListConnectionsHandler Unit Tests', () => {
  let handler: ListConnectionsHandler
  let mockConnectionManager: any

  beforeEach(() => {
    mockConnectionManager = {
      getConnectionsList: vi.fn().mockReturnValue([
        {
          id: 'local-default',
          type: 'local',
          name: 'Local',
          isActive: true,
          details: { type: 'local', php: '/usr/bin/php' },
        },
        {
          id: 'docker-app-1',
          type: 'docker',
          name: 'my-docker-app',
          isActive: false,
          details: { type: 'docker', container_name: 'my-docker-app' },
        },
      ]),
    }

    handler = new ListConnectionsHandler(mockConnectionManager)
  })

  it('lists all configured connections', async () => {
    const result = await handler.handle()

    expect(result.connections.length).toBe(2)
    expect(result.activeConnection?.id).toBe('local-default')
    expect(result.connections[0].isActive).toBe(true)
    expect(result.connections[1].isActive).toBe(false)
  })

  it('filters connections by typeFilter', async () => {
    const result = await handler.handle({ typeFilter: 'docker' })

    expect(result.connections.length).toBe(1)
    expect(result.connections[0].type).toBe('docker')
    expect(result.connections[0].name).toBe('my-docker-app')
  })

  it('returns null activeConnection if active connection is not in filtered list', async () => {
    const result = await handler.handle({ typeFilter: 'docker' })

    expect(result.activeConnection).toBeNull()
  })
})
