<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import {
    PlusIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    FolderIcon,
    FolderPlusIcon,
    StarIcon,
  } from '@heroicons/vue/24/outline'
  import draggable from 'vuedraggable'
  import { useTabsStore } from '../stores/tabs'
  import { useFoldersStore } from '../stores/folders'
  import { useSettingsStore } from '../stores/settings'
  import router from '../router'
  import events from '../events'
  import ProjectTile from './ProjectTile.vue'
  import ProjectMenuContext from './contextMenus/ProjectMenuContext.vue'
  import FolderMenuContext from './contextMenus/FolderMenuContext.vue'
  import NewFolderModal from './NewFolderModal.vue'
  import { Tab } from '../../types/tab.type'
  import { WorkspaceFolder } from '../../types/workspace-folder.type'

  const VISIBLE_LIMIT = 5
  const MORE_STEP = 15

  const emit = defineEmits(['open-new-project'])

  const tabsStore = useTabsStore()
  const foldersStore = useFoldersStore()
  const settingsStore = useSettingsStore()

  const workspaceGroup = { name: 'workspaces', pull: true, put: true }

  // ---- groups ----
  const rootTabs = computed<Tab[]>(() => {
    const all = tabsStore.tabs.filter(t => (t.folder_id ?? null) === null)
    return [...all.filter(t => t.pinned), ...all.filter(t => !t.pinned)]
  })

  const folderTabs = (folderId: number): Tab[] => {
    const all = tabsStore.tabs.filter(t => t.folder_id === folderId)
    return [...all.filter(t => t.pinned), ...all.filter(t => !t.pinned)]
  }

  // ---- show more (per folder, resets on restart) ----
  const extraShown = reactive<Record<number, number>>({})

  const visibleFolderTabs = (folder: WorkspaceFolder): Tab[] => {
    const all = folderTabs(folder.id)
    return all.slice(0, VISIBLE_LIMIT + (extraShown[folder.id] ?? 0))
  }

  const hiddenCount = (folder: WorkspaceFolder): number => {
    const all = folderTabs(folder.id)
    return Math.max(0, all.length - (VISIBLE_LIMIT + (extraShown[folder.id] ?? 0)))
  }

  const nextStepCount = (folder: WorkspaceFolder): number => Math.min(MORE_STEP, hiddenCount(folder))

  const showMore = (folderId: number) => {
    extraShown[folderId] = (extraShown[folderId] ?? 0) + MORE_STEP
  }

  const showLess = (folderId: number) => {
    extraShown[folderId] = Math.max(0, (extraShown[folderId] ?? 0) - MORE_STEP)
  }

  // ---- collapsed folders (persisted in the folders store) ----
  const isFolderCollapsed = (id: number): boolean => foldersStore.isCollapsed(id)

  const toggleFolder = (id: number) => {
    foldersStore.toggleFolder(id)
  }

  const expandFolder = (id: number) => {
    foldersStore.expandFolder(id)
  }

  // ---- spring-loaded folders: expand a collapsed folder when a dragged
  // workspace hovers over its header, collapse it back when the drag ends ----
  // dragover fires repeatedly while hovering (~every 350ms), so the delay is
  // measured from the first hover event instead of resetting a timer each time
  const SPRING_LOAD_DELAY = 600
  const draggingWorkspace = ref(false)
  const autoExpandedDuringDrag = new Set<number>()
  const springLoadHoveredAt = new Map<number, number>()

  const clearSpringLoadHover = (folderId: number) => {
    springLoadHoveredAt.delete(folderId)
  }

  const onFolderHeaderDragOver = (folder: WorkspaceFolder) => {
    if (!draggingWorkspace.value || !isFolderCollapsed(folder.id)) {
      return
    }
    if (!springLoadHoveredAt.has(folder.id)) {
      springLoadHoveredAt.set(folder.id, Date.now())
      return
    }
    if (Date.now() - (springLoadHoveredAt.get(folder.id) as number) >= SPRING_LOAD_DELAY) {
      springLoadHoveredAt.delete(folder.id)
      expandFolder(folder.id)
      autoExpandedDuringDrag.add(folder.id)
    }
  }

  const onFolderHeaderDragLeave = (folder: WorkspaceFolder, event: DragEvent) => {
    // ignore transitions between the header's own child elements
    const header = event.currentTarget as HTMLElement
    if (event.relatedTarget && header.contains(event.relatedTarget as Node)) {
      return
    }
    clearSpringLoadHover(folder.id)
  }

  const onWorkspaceDragStart = () => {
    draggingWorkspace.value = true
  }

  const onWorkspaceDragEnd = () => {
    draggingWorkspace.value = false
    springLoadHoveredAt.clear()
    autoExpandedDuringDrag.forEach(id => {
      if (!foldersStore.isCollapsed(id)) {
        foldersStore.collapseFolder(id)
      }
    })
    autoExpandedDuringDrag.clear()
  }

  // ---- actions ----
  const openTab = (tab: Tab) => {
    router.replace({ name: 'code', params: { id: tab.id } })
  }

  const requestCloseTab = (id: number) => {
    events.dispatchEvent(new CustomEvent('tab.close.request', { detail: id }))
  }

  const isActive = (tab: Tab): boolean => {
    return router.currentRoute.value.name === 'code' && tabsStore.getCurrent()?.id === tab.id
  }

  const openFolderFromCollapsed = (folder: WorkspaceFolder) => {
    settingsStore.settings.navigationDisplay = 'expanded'
    settingsStore.update()
    expandFolder(folder.id)
  }

  // ---- new folder ----
  const newFolderModal = ref()

  const openNewFolderModal = () => {
    newFolderModal.value?.openModal()
  }

  // New folders are created collapsed
  const onFolderCreated = (folder: WorkspaceFolder) => {
    foldersStore.collapseFolder(folder.id)
  }
</script>

<template>
  <div class="min-h-full max-h-full no-scrollbar overflow-y-auto p-2 space-y-2">
    <!-- Add new project -->
    <button @click="emit('open-new-project')" class="w-full">
      <ProjectTile tooltip="Add new project" tooltip-placement="right" :expanded="settingsStore.isNavigationExpanded">
        <PlusIcon class="w-4 h-4 flex-shrink-0" />
        <span v-if="settingsStore.isNavigationExpanded" class="ml-2 text-sm truncate block min-w-0 flex-1">
          Add new project
        </span>
      </ProjectTile>
    </button>

    <!-- Root workspaces (expanded sidebar) -->
    <draggable
      v-if="settingsStore.isNavigationExpanded"
      :model-value="rootTabs"
      @update:model-value="tabsStore.applyGroupOrder(null, $event)"
      item-key="id"
      :group="workspaceGroup"
      :animation="150"
      ghost-class="opacity-40"
      class="space-y-2"
      @start="onWorkspaceDragStart"
      @end="onWorkspaceDragEnd"
    >
      <template #item="{ element: tab }">
        <div>
          <ProjectMenuContext :tab="tab">
            <ProjectTile
              :active="isActive(tab)"
              :name="tab.name"
              :expanded="settingsStore.isNavigationExpanded"
              @click="openTab(tab)"
              @mousedown.middle="requestCloseTab(tab.id)"
            >
              <span class="flex items-center text-sm truncate block min-w-0 flex-1">
                <StarIcon v-if="tab.pinned" class="w-3 h-3 mr-1.5 shrink-0 text-primary-500" aria-label="Pinned" />
                <span class="truncate">{{ tab.name }}</span>
              </span>
            </ProjectTile>
          </ProjectMenuContext>
        </div>
      </template>
    </draggable>

    <!-- Root workspaces (collapsed sidebar) -->
    <draggable
      v-else
      :model-value="rootTabs"
      @update:model-value="tabsStore.applyGroupOrder(null, $event)"
      item-key="id"
      :group="workspaceGroup"
      :animation="150"
      ghost-class="opacity-40"
      class="space-y-2"
    >
      <template #item="{ element: tab }">
        <div>
          <ProjectMenuContext :tab="tab">
            <ProjectTile
              :active="isActive(tab)"
              :name="tab.name"
              :tooltip="tab.name"
              :expanded="false"
              tooltip-placement="right"
              @click="openTab(tab)"
              @mousedown.middle="requestCloseTab(tab.id)"
            >
              <span class="flex-shrink-0">
                {{ tab.name[0] }}
              </span>
            </ProjectTile>
          </ProjectMenuContext>
        </div>
      </template>
    </draggable>

    <!-- Folders (expanded sidebar) -->
    <draggable
      v-if="settingsStore.isNavigationExpanded"
      :model-value="foldersStore.folders"
      @update:model-value="foldersStore.setFoldersOrder($event)"
      item-key="id"
      group="workspace-folders"
      handle="[data-folder-handle]"
      :animation="150"
      ghost-class="opacity-40"
      class="space-y-2"
    >
      <template #item="{ element: folder }">
        <div class="space-y-2">
          <FolderMenuContext :folder="folder">
            <div
              data-folder-handle
              class="flex items-center w-full h-7 px-2 rounded-md cursor-pointer select-none text-xs transition-all hover:bg-black/10"
              :style="{
                color: settingsStore.colors.foreground,
              }"
              @click="toggleFolder(folder.id)"
              @dragover="onFolderHeaderDragOver(folder)"
              @dragleave="onFolderHeaderDragLeave(folder, $event)"
              v-tippy="{ content: folder.name, placement: 'right' }"
            >
              <ChevronRightIcon v-if="isFolderCollapsed(folder.id)" class="w-3 h-3 mr-1 shrink-0 opacity-60" />
              <ChevronDownIcon v-else class="w-3 h-3 mr-1 shrink-0 opacity-60" />
              <FolderIcon class="w-3.5 h-3.5 mr-1.5 shrink-0 opacity-70" />
              <span class="truncate">{{ folder.name }}</span>
              <span class="ml-auto pl-1 opacity-50">{{ folderTabs(folder.id).length }}</span>
            </div>
          </FolderMenuContext>

          <div v-if="!isFolderCollapsed(folder.id)" class="ml-3 space-y-2">
            <draggable
              :model-value="visibleFolderTabs(folder)"
              @update:model-value="tabsStore.applyGroupOrder(folder.id, $event)"
              item-key="id"
              :group="workspaceGroup"
              :animation="150"
              ghost-class="opacity-40"
              class="space-y-2 min-h-[12px]"
              :empty-insert-threshold="24"
              @start="onWorkspaceDragStart"
              @end="onWorkspaceDragEnd"
            >
              <template #header>
                <div
                  v-if="folderTabs(folder.id).length === 0"
                  class="px-3 py-1 text-xs italic opacity-50"
                  :style="{ color: settingsStore.colors.foreground }"
                >
                  No projects
                </div>
              </template>
              <template #item="{ element: tab }">
                <div>
                  <ProjectMenuContext :tab="tab">
                    <ProjectTile
                      :active="isActive(tab)"
                      :name="tab.name"
                      :expanded="settingsStore.isNavigationExpanded"
                      @click="openTab(tab)"
                      @mousedown.middle="requestCloseTab(tab.id)"
                    >
                      <span class="flex items-center text-sm truncate block min-w-0 flex-1">
                        <StarIcon
                          v-if="tab.pinned"
                          class="w-3 h-3 mr-1.5 shrink-0 text-primary-500"
                          aria-label="Pinned"
                        />
                        <span class="truncate">{{ tab.name }}</span>
                      </span>
                    </ProjectTile>
                  </ProjectMenuContext>
                </div>
              </template>
            </draggable>

            <button
              v-if="hiddenCount(folder) > 0"
              @click="showMore(folder.id)"
              class="w-full text-start px-3 py-1 text-xs opacity-60 hover:opacity-100 hover:text-primary-500 transition-all"
            >
              Show more (+{{ nextStepCount(folder) }})
            </button>
            <button
              v-else-if="(extraShown[folder.id] ?? 0) > 0"
              @click="showLess(folder.id)"
              class="w-full text-start px-3 py-1 text-xs opacity-60 hover:opacity-100 hover:text-primary-500 transition-all"
            >
              Show less
            </button>
          </div>
        </div>
      </template>
    </draggable>

    <!-- Folders (collapsed sidebar) -->
    <draggable
      v-else
      :model-value="foldersStore.folders"
      @update:model-value="foldersStore.setFoldersOrder($event)"
      item-key="id"
      group="workspace-folders"
      :animation="150"
      ghost-class="opacity-40"
      class="space-y-2"
    >
      <template #item="{ element: folder }">
        <div>
          <FolderMenuContext :folder="folder">
            <div
              class="text-md flex h-8 w-8 justify-center capitalize items-center rounded-lg cursor-pointer hover:bg-black/10 transition-all"
              :style="{
                color: settingsStore.colors.foreground,
              }"
              @click="openFolderFromCollapsed(folder)"
              v-tippy="{ content: `${folder.name} (${folderTabs(folder.id).length})`, placement: 'right' }"
            >
              <FolderIcon class="w-4 h-4" />
            </div>
          </FolderMenuContext>
        </div>
      </template>
    </draggable>

    <!-- New folder -->
    <button
      v-if="settingsStore.isNavigationExpanded"
      @click="openNewFolderModal()"
      class="flex items-center h-7 px-2 w-full rounded-md text-xs opacity-50 hover:opacity-100 hover:text-primary-500 transition-all"
    >
      <FolderPlusIcon class="w-3.5 h-3.5 mr-1.5 shrink-0" />
      <span>New folder</span>
    </button>
    <button v-else @click="openNewFolderModal()" v-tippy="{ content: 'New folder', placement: 'right' }">
      <ProjectTile tooltip="" tooltip-placement="right" :expanded="false">
        <FolderPlusIcon class="w-4 h-4 flex-shrink-0 opacity-50" />
      </ProjectTile>
    </button>
  </div>

  <NewFolderModal ref="newFolderModal" @created="onFolderCreated" />
</template>
