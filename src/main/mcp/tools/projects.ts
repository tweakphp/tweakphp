/**
 * Project (open tab) management tools for MCP
 * 1:1 with the frontend project features: create, rename, change color/tag,
 * pin, move to folder, duplicate, remove (trash) and restore.
 */

import {
  ListProjectsParams,
  CreateProjectParams,
  UpdateProjectParams,
  DeleteProjectParams,
  RestoreProjectParams,
  DuplicateProjectParams,
  SetActiveProjectParams,
} from './schemas'
import { TabsRepository, TabRecord } from '../../db/repositories/tabs-repository'
import { WorkspaceFoldersRepository } from '../../db/repositories/workspace-folders-repository'
import { ConnectionsRepository } from '../../db/repositories/connections-repository'
import { AppStorageRepository } from '../../db/repositories/app-storage-repository'
import { broadcastAppChange } from '../../ipc/broadcast'
import { syncConnectionsToMcpManagerIfActive } from '../../ipc/connections-ipc'
import { MCPErrorCode } from '../types'
import { getErrorHandler } from '../error-handler'
import { assignConnectionToProject } from './project-connection'

export interface ProjectHandlerDeps {
  tabsRepo?: TabsRepository
  foldersRepo?: WorkspaceFoldersRepository
  connectionsRepo?: ConnectionsRepository
  appStorage?: AppStorageRepository
}

export interface ProjectSummary {
  id: number
  name: string
  type: string
  path: string | null
  execution: string
  connectionId: string | null
  folderId: number | null
  folderName: string | null
  pinned: boolean
  color: string | null
  tag: string | null
  loader: string | null
  code: string
  createdAt: string | null
  updatedAt: string | null
}

export class ListProjectsHandler {
  private tabsRepo: TabsRepository
  private foldersRepo: WorkspaceFoldersRepository

  constructor(deps: ProjectHandlerDeps = {}) {
    this.tabsRepo = deps.tabsRepo ?? new TabsRepository()
    this.foldersRepo = deps.foldersRepo ?? new WorkspaceFoldersRepository()
  }

  async handle(params?: ListProjectsParams): Promise<{ projects: ProjectSummary[] }> {
    const tabs = params?.includeTrashed
      ? this.tabsRepo.getAllTabs(true)
      : this.tabsRepo.getAllTabs(false)
    const folders = new Map(this.foldersRepo.getAllFolders().map(folder => [folder.id, folder.name]))

    let projects = tabs.map(tab => this.toSummary(tab, folders.get(tab.folder_id ?? -1) ?? null))

    if (params?.folderId !== undefined) {
      projects = projects.filter(project => project.folderId === params.folderId)
    }

    return { projects }
  }

  private toSummary(tab: TabRecord, folderName: string | null): ProjectSummary {
    return {
      id: tab.id,
      name: tab.name,
      type: tab.type,
      path: tab.path ?? null,
      execution: tab.execution,
      connectionId: tab.connection_id ?? null,
      folderId: tab.folder_id ?? null,
      folderName,
      pinned: Boolean(tab.pinned),
      color: tab.color ?? null,
      tag: tab.tag ?? null,
      loader: tab.loader ?? null,
      code: tab.code,
      createdAt: tab.created_at ?? null,
      updatedAt: tab.updated_at ?? null,
    }
  }
}

export class CreateProjectHandler {
  private tabsRepo: TabsRepository
  private foldersRepo: WorkspaceFoldersRepository
  private appStorage: AppStorageRepository
  private errorHandler = getErrorHandler()

  constructor(deps: ProjectHandlerDeps = {}) {
    this.tabsRepo = deps.tabsRepo ?? new TabsRepository()
    this.foldersRepo = deps.foldersRepo ?? new WorkspaceFoldersRepository()
    this.appStorage = deps.appStorage ?? new AppStorageRepository()
  }

  async handle(params: CreateProjectParams): Promise<ProjectSummary> {
    if (!params.path || typeof params.path !== 'string') {
      throw this.errorHandler.createError(MCPErrorCode.INVALID_PARAMETERS, 'Parameter "path" is required')
    }

    if (params.folderId !== undefined && params.folderId !== null) {
      const folder = this.foldersRepo.getAllFolders().find(f => f.id === params.folderId)
      if (!folder) {
        throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Folder ${params.folderId} not found`)
      }
    }

    // Same defaults as the frontend addTab()
    const id = Date.now()
    const name = params.name?.trim() || params.path.split(/[/\\]/).pop() || params.path

    const tab: TabRecord = {
      id,
      name,
      type: 'code',
      code: params.code ?? '<?php\n\n',
      path: params.path,
      execution: 'local',
      loader: undefined,
      result: [],
      queries: [],
      pane: { code: 50, result: 50 },
      info: { name: '', php_version: '', version: '' },
      folder_id: params.folderId ?? null,
      pinned: false,
      color: params.color ?? null,
      tag: params.tag ?? null,
      connection_id: null,
      position: 0,
      deleted_at: null,
    }

    this.tabsRepo.saveTab(tab)
    this.trackRecentProject(params.path)
    broadcastAppChange('app:tabs:changed')

    return {
      id: tab.id,
      name: tab.name,
      type: tab.type,
      path: tab.path ?? null,
      execution: tab.execution,
      connectionId: null,
      folderId: tab.folder_id ?? null,
      folderName: null,
      pinned: false,
      color: tab.color ?? null,
      tag: tab.tag ?? null,
      loader: null,
      code: tab.code,
      createdAt: null,
      updatedAt: null,
    }
  }

  // keep the frontend "recent projects" list in sync
  private trackRecentProject(path: string): void {
    try {
      const key = 'renderer.history'
      const stored = this.appStorage.get<any[]>(key) ?? []
      const history = stored.map(item => (typeof item === 'string' ? { path: item } : item))
      if (!history.some(item => item.path === path)) {
        history.push({ path })
        this.appStorage.set(key, history)
      }
    } catch {
      // recent projects tracking is best-effort
    }
  }
}

export class UpdateProjectHandler {
  private tabsRepo: TabsRepository
  private foldersRepo: WorkspaceFoldersRepository
  private errorHandler = getErrorHandler()

  constructor(deps: ProjectHandlerDeps = {}) {
    this.tabsRepo = deps.tabsRepo ?? new TabsRepository()
    this.foldersRepo = deps.foldersRepo ?? new WorkspaceFoldersRepository()
  }

  async handle(params: UpdateProjectParams): Promise<ProjectSummary> {
    const tab = this.tabsRepo.getTab(params.projectId)
    if (!tab) {
      throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Project ${params.projectId} not found`)
    }

    if (params.name !== undefined) {
      const name = params.name.trim()
      if (!name) {
        throw this.errorHandler.createError(MCPErrorCode.INVALID_PARAMETERS, 'Project name cannot be empty')
      }
      tab.name = name
    }

    // Editor content: flag the broadcast so an open editor takes the new code
    // instead of keeping the in-memory version (which would overwrite it on save)
    const codeUpdated = params.code !== undefined
    if (codeUpdated) {
      tab.code = params.code as string
    }

    if (params.folderId !== undefined) {
      if (params.folderId !== null) {
        const folder = this.foldersRepo.getAllFolders().find(f => f.id === params.folderId)
        if (!folder) {
          throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Folder ${params.folderId} not found`)
        }
      }
      tab.folder_id = params.folderId
    }

    if (params.color !== undefined) tab.color = params.color
    if (params.tag !== undefined) tab.tag = params.tag
    if (params.pinned !== undefined) tab.pinned = params.pinned

    this.tabsRepo.saveTab(tab)
    broadcastAppChange('app:tabs:changed', codeUpdated ? { codeUpdatedForTabId: tab.id } : undefined)

    return {
      id: tab.id,
      name: tab.name,
      type: tab.type,
      path: tab.path ?? null,
      execution: tab.execution,
      connectionId: tab.connection_id ?? null,
      folderId: tab.folder_id ?? null,
      folderName: null,
      pinned: Boolean(tab.pinned),
      color: tab.color ?? null,
      tag: tab.tag ?? null,
      loader: tab.loader ?? null,
      code: tab.code,
      createdAt: tab.created_at ?? null,
      updatedAt: tab.updated_at ?? null,
    }
  }
}

export class DeleteProjectHandler {
  private tabsRepo: TabsRepository
  private errorHandler = getErrorHandler()

  constructor(deps: ProjectHandlerDeps = {}) {
    this.tabsRepo = deps.tabsRepo ?? new TabsRepository()
  }

  async handle(params: DeleteProjectParams): Promise<{ success: boolean; projectId: number; trashed: boolean }> {
    const deleted = this.tabsRepo.deleteTab(params.projectId, Boolean(params.force))
    if (!deleted) {
      throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Project ${params.projectId} not found`)
    }

    broadcastAppChange('app:tabs:changed')

    // Force delete cascades the project's connections (FK ON DELETE CASCADE):
    // resync the renderer stores and the MCP connection manager
    if (params.force) {
      broadcastAppChange('app:connections:changed')
      syncConnectionsToMcpManagerIfActive()
    }

    return { success: true, projectId: params.projectId, trashed: !params.force }
  }
}

export class RestoreProjectHandler {
  private tabsRepo: TabsRepository
  private errorHandler = getErrorHandler()

  constructor(deps: ProjectHandlerDeps = {}) {
    this.tabsRepo = deps.tabsRepo ?? new TabsRepository()
  }

  async handle(params: RestoreProjectParams): Promise<{ success: boolean; projectId: number }> {
    const restored = this.tabsRepo.restoreTab(params.projectId)
    if (!restored) {
      throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Trashed project ${params.projectId} not found`)
    }
    broadcastAppChange('app:tabs:changed')
    return { success: true, projectId: params.projectId }
  }
}

export class DuplicateProjectHandler {
  private tabsRepo: TabsRepository
  private connectionsRepo: ConnectionsRepository
  private errorHandler = getErrorHandler()

  constructor(deps: ProjectHandlerDeps = {}) {
    this.tabsRepo = deps.tabsRepo ?? new TabsRepository()
    this.connectionsRepo = deps.connectionsRepo ?? new ConnectionsRepository()
  }

  async handle(params: DuplicateProjectParams): Promise<ProjectSummary> {
    const source = this.tabsRepo.getTab(params.projectId)
    if (!source) {
      throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Project ${params.projectId} not found`)
    }

    const cloneId = Date.now()

    // Connections are atomic to a project: the clone must own its own copies,
    // never share the source's rows.
    let copiedConnectionId: string | null = null
    if (source.execution === 'vapor') {
      // Vapor configs are keyed by tab id: copy the source config over
      const vapor = this.connectionsRepo.getConnection(String(source.id))
      if (vapor) {
        const { id, ...config } = vapor
        this.connectionsRepo.saveConnection({ ...config, id: cloneId, tab_id: cloneId })
      }
    } else if (source.connection_id) {
      const active = this.connectionsRepo.getConnection(source.connection_id)
      if (active) {
        const copyId = this.uniqueConnectionId()
        const { id, ...config } = active
        this.connectionsRepo.saveConnection({ ...config, id: copyId, tab_id: cloneId })
        copiedConnectionId = String(copyId)
      }
    }

    const clone: TabRecord = {
      ...source,
      id: cloneId,
      connection_id: source.execution === 'vapor' ? String(cloneId) : copiedConnectionId ?? source.connection_id ?? null,
      position: (source.position ?? 0) + 0.5,
      created_at: undefined,
      updated_at: undefined,
    }

    this.tabsRepo.saveTab(clone)

    // Sync execution + legacy refs for the copied connection (same as connect)
    if (copiedConnectionId) {
      assignConnectionToProject(cloneId, copiedConnectionId, {
        tabsRepo: this.tabsRepo,
        connectionsRepo: this.connectionsRepo,
      })
    }

    broadcastAppChange('app:tabs:changed')
    broadcastAppChange('app:connections:changed')

    return {
      id: clone.id,
      name: clone.name,
      type: clone.type,
      path: clone.path ?? null,
      execution: clone.execution,
      connectionId: clone.connection_id ?? null,
      folderId: clone.folder_id ?? null,
      folderName: null,
      pinned: Boolean(clone.pinned),
      color: clone.color ?? null,
      tag: clone.tag ?? null,
      loader: clone.loader ?? null,
      code: clone.code,
      createdAt: null,
      updatedAt: null,
    }
  }

  // Numeric id (Date.now-based) that does not collide with stored connections
  private uniqueConnectionId(): number {
    let id = Date.now()
    while (this.connectionsRepo.getConnection(String(id))) {
      id++
    }
    return id
  }
}

export class SetActiveProjectHandler {
  private tabsRepo: TabsRepository
  private appStorage: AppStorageRepository
  private errorHandler = getErrorHandler()

  constructor(deps: ProjectHandlerDeps = {}) {
    this.tabsRepo = deps.tabsRepo ?? new TabsRepository()
    this.appStorage = deps.appStorage ?? new AppStorageRepository()
  }

  async handle(params: SetActiveProjectParams): Promise<{ success: boolean; projectId: number }> {
    const tab = this.tabsRepo.getTab(params.projectId)
    if (!tab) {
      throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Project ${params.projectId} not found`)
    }

    this.appStorage.set('renderer.current-tab', String(params.projectId))
    broadcastAppChange('app:tabs:changed', { currentProjectId: params.projectId })
    return { success: true, projectId: params.projectId }
  }
}
