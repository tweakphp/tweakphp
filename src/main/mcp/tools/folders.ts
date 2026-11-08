/**
 * Workspace folder management tools for MCP
 * 1:1 with the frontend folder features: create, rename, delete and reorder.
 */

import { CreateFolderParams, UpdateFolderParams, DeleteFolderParams, ReorderFoldersParams } from './schemas'
import { WorkspaceFoldersRepository } from '../../db/repositories/workspace-folders-repository'
import { WorkspaceFolder } from '../../../types/workspace-folder.type'
import { broadcastAppChange } from '../../ipc/broadcast'
import { MCPErrorCode } from '../types'
import { getErrorHandler } from '../error-handler'

const MAX_FOLDER_NAME_LENGTH = 100

export interface FolderHandlerDeps {
  foldersRepo?: WorkspaceFoldersRepository
}

export class ListFoldersHandler {
  private foldersRepo: WorkspaceFoldersRepository

  constructor(deps: FolderHandlerDeps = {}) {
    this.foldersRepo = deps.foldersRepo ?? new WorkspaceFoldersRepository()
  }

  async handle(): Promise<{ folders: WorkspaceFolder[] }> {
    return { folders: this.foldersRepo.getAllFolders() }
  }
}

export class CreateFolderHandler {
  private foldersRepo: WorkspaceFoldersRepository
  private errorHandler = getErrorHandler()

  constructor(deps: FolderHandlerDeps = {}) {
    this.foldersRepo = deps.foldersRepo ?? new WorkspaceFoldersRepository()
  }

  async handle(params: CreateFolderParams): Promise<WorkspaceFolder> {
    const name = (params.name ?? '').trim()
    if (!name || name.length > MAX_FOLDER_NAME_LENGTH) {
      throw this.errorHandler.createError(
        MCPErrorCode.INVALID_PARAMETERS,
        `Folder name must be between 1 and ${MAX_FOLDER_NAME_LENGTH} characters`
      )
    }

    const folder = this.foldersRepo.createFolder(name)
    broadcastAppChange('app:folders:changed')
    return folder
  }
}

export class UpdateFolderHandler {
  private foldersRepo: WorkspaceFoldersRepository
  private errorHandler = getErrorHandler()

  constructor(deps: FolderHandlerDeps = {}) {
    this.foldersRepo = deps.foldersRepo ?? new WorkspaceFoldersRepository()
  }

  async handle(params: UpdateFolderParams): Promise<{ success: boolean }> {
    const folder = this.foldersRepo.getAllFolders().find(f => f.id === params.folderId)
    if (!folder) {
      throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Folder ${params.folderId} not found`)
    }

    let name = folder.name
    if (params.name !== undefined) {
      name = params.name.trim()
      if (!name || name.length > MAX_FOLDER_NAME_LENGTH) {
        throw this.errorHandler.createError(
          MCPErrorCode.INVALID_PARAMETERS,
          `Folder name must be between 1 and ${MAX_FOLDER_NAME_LENGTH} characters`
        )
      }
    }

    const updated = this.foldersRepo.updateFolder({ ...folder, name })
    broadcastAppChange('app:folders:changed')
    return { success: updated }
  }
}

export class DeleteFolderHandler {
  private foldersRepo: WorkspaceFoldersRepository
  private errorHandler = getErrorHandler()

  constructor(deps: FolderHandlerDeps = {}) {
    this.foldersRepo = deps.foldersRepo ?? new WorkspaceFoldersRepository()
  }

  async handle(params: DeleteFolderParams): Promise<{ success: boolean }> {
    const deleted = this.foldersRepo.deleteFolder(params.folderId)
    if (!deleted) {
      throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Folder ${params.folderId} not found`)
    }
    // projects previously assigned to the folder are now unassigned
    broadcastAppChange('app:folders:changed')
    broadcastAppChange('app:tabs:changed')
    return { success: true }
  }
}

export class ReorderFoldersHandler {
  private foldersRepo: WorkspaceFoldersRepository
  private errorHandler = getErrorHandler()

  constructor(deps: FolderHandlerDeps = {}) {
    this.foldersRepo = deps.foldersRepo ?? new WorkspaceFoldersRepository()
  }

  async handle(params: ReorderFoldersParams): Promise<{ success: boolean }> {
    if (!Array.isArray(params.folderIds) || params.folderIds.length === 0) {
      throw this.errorHandler.createError(
        MCPErrorCode.INVALID_PARAMETERS,
        'Parameter "folderIds" must be a non-empty array'
      )
    }

    const existing = new Set(this.foldersRepo.getAllFolders().map(f => f.id))
    const unknown = params.folderIds.filter(id => !existing.has(id))
    if (unknown.length > 0) {
      throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Unknown folder ids: ${unknown.join(', ')}`)
    }

    this.foldersRepo.reorderFolders(params.folderIds)
    broadcastAppChange('app:folders:changed')
    return { success: true }
  }
}
