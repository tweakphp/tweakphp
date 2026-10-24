<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import {
    PlusIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    FolderIcon,
    FolderOpenIcon,
    FolderPlusIcon,
    EllipsisHorizontalIcon,
    StarIcon,
  } from '@heroicons/vue/24/outline'
  import draggable from 'vuedraggable'
  import { useTabsStore } from '../stores/tabs'
  import { useFoldersStore } from '../stores/folders'
  import { useSectionsStore } from '../stores/sections'
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
  const sectionsStore = useSectionsStore()
  const settingsStore = useSettingsStore()

  // put: '<group>' rejects drops coming from other groups. With `put: true`
  // SortableJS accepts any group, so a dragged folder could land in a
  // projects list and be persisted as a broken tab (no editor).
  const workspaceGroup = { name: 'workspaces', pull: true, put: 'workspaces' }
  // Folders are a flat list: only folders can be dropped here (reorder),
  // never a workspace, and never a folder inside another folder.
  const foldersGroup = { name: 'workspace-folders', pull: true, put: 'workspace-folders' }

  // ---- groups ----
  // The sidebar is split in three blocks: pinned workspaces (every pinned
  // tab, even the ones in a folder: pinning wins over the folder), folders
  // (unpinned tabs grouped by folder) and recent workspaces (unpinned tabs
  // without a folder).
  const pinnedTabs = computed<Tab[]>(() => tabsStore.tabs.filter(t => t.pinned))

  const recentTabs = computed<Tab[]>(() => {
    return tabsStore.tabs.filter(t => !t.pinned && (t.folder_id ?? null) === null)
  })

  const folderTabs = (folderId: number): Tab[] => {
    return tabsStore.tabs.filter(t => !t.pinned && t.folder_id === folderId)
  }

  // ---- show more (per folder, resets on restart and on folder collapse) ----
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

  // ---- spring-loaded folders: expand a collapsed folder while dragging over
  // it. Keep the destination open after a drop; close other temporary opens. ----
  // dragover fires repeatedly while hovering (~every 350ms), so the delay is
  // measured from the first hover event instead of resetting a timer each time
  const SPRING_LOAD_DELAY = 600
  const draggingWorkspace = ref(false)
  const autoExpandedDuringDrag = new Set<number>()
  const springLoadHoveredAt = new Map<number, number>()
  let droppedIntoFolderId: number | null = null

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
    droppedIntoFolderId = null
  }

  const onWorkspaceAddedToFolder = (folderId: number) => {
    droppedIntoFolderId = folderId
  }

  const onWorkspaceDragEnd = () => {
    draggingWorkspace.value = false
    springLoadHoveredAt.clear()
    autoExpandedDuringDrag.forEach(id => {
      if (id !== droppedIntoFolderId && !foldersStore.isCollapsed(id)) {
        foldersStore.collapseFolder(id)
      }
    })
    autoExpandedDuringDrag.clear()
    droppedIntoFolderId = null
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

  // reset a folder's "Show more" steps when it gets collapsed (any path:
  // header toggle in the expanded sidebar, spring-load collapse after drag,
  // tile toggle in the collapsed sidebar)
  watch(
    () => foldersStore.collapsedIds,
    ids => {
      Object.keys(extraShown).forEach(key => {
        if (ids.has(Number(key))) {
          delete extraShown[Number(key)]
        }
      })
    }
  )

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
  <div class="h-full min-h-0 flex flex-col" :class="settingsStore.isNavigationExpanded ? 'py-3 pl-3' : 'p-2'">
    <!-- Add new project -->
    <div class="shrink-0" :class="{ 'pr-3': settingsStore.isNavigationExpanded }">
      <button @click="emit('open-new-project')" class="w-full">
        <ProjectTile
          tooltip="Add new project"
          tooltip-placement="right"
          :expanded="settingsStore.isNavigationExpanded"
          :sidebar="settingsStore.isNavigationExpanded"
        >
          <PlusIcon class="w-4 h-4 flex-shrink-0" />
          <span v-if="settingsStore.isNavigationExpanded" class="ml-3 text-sm truncate block min-w-0 flex-1">
            Add new project
          </span>
        </ProjectTile>
      </button>
    </div>

    <div
      class="min-h-0 flex-1 overflow-y-auto"
      :class="settingsStore.isNavigationExpanded ? 'workspace-scrollbar' : 'no-scrollbar mt-2 space-y-2'"
      :style="{ '--workspace-scrollbar-color': settingsStore.colors.foreground }"
    >
      <!-- Pinned workspaces (expanded sidebar) -->
      <div v-if="settingsStore.isNavigationExpanded && pinnedTabs.length > 0" class="mt-3">
        <button
          type="button"
          class="group flex items-center w-full h-8 px-2 rounded-lg text-left text-sm font-medium opacity-50 transition-opacity enabled:hover:opacity-80"
          :aria-expanded="!sectionsStore.isCollapsed('pinned')"
          @click="sectionsStore.toggleSection('pinned')"
        >
          <span>Pinned</span>
          <ChevronRightIcon v-if="sectionsStore.isCollapsed('pinned')" class="w-4 h-4 ml-1" />
          <ChevronDownIcon
            v-else
            class="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        </button>
        <draggable
          v-if="!sectionsStore.isCollapsed('pinned')"
          :model-value="pinnedTabs"
          @update:model-value="tabsStore.applyPinnedOrder($event)"
          item-key="id"
          :group="workspaceGroup"
          :animation="150"
          ghost-class="opacity-40"
          class="min-h-[8px]"
          :empty-insert-threshold="24"
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
                  sidebar
                  @click="openTab(tab)"
                  @mousedown.middle="requestCloseTab(tab.id)"
                >
                  <span class="flex items-center text-sm truncate block min-w-0 flex-1">
                    <span class="truncate">{{ tab.name }}</span>
                  </span>
                </ProjectTile>
              </ProjectMenuContext>
            </div>
          </template>
        </draggable>
      </div>

      <!-- Pinned workspaces (collapsed sidebar) -->
      <draggable
        v-if="!settingsStore.isNavigationExpanded && pinnedTabs.length > 0"
        :model-value="pinnedTabs"
        @update:model-value="tabsStore.applyPinnedOrder($event)"
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
                :tooltip="tab.name"
                :expanded="false"
                tooltip-placement="right"
                @click="openTab(tab)"
                @mousedown.middle="requestCloseTab(tab.id)"
              >
                <span class="flex-shrink-0 relative">
                  {{ tab.name[0] }}
                  <StarIcon class="absolute -top-1 -right-1.5 w-2.5 h-2.5 text-primary-500" aria-label="Pinned" />
                </span>
              </ProjectTile>
            </ProjectMenuContext>
          </div>
        </template>
      </draggable>

      <!-- Folders (expanded sidebar) -->
      <div v-if="settingsStore.isNavigationExpanded" class="mt-3">
        <div class="flex items-center h-8 px-2 text-sm font-medium opacity-50">
          <button
            type="button"
            class="group flex items-center min-w-0 rounded-lg hover:opacity-80"
            :aria-expanded="!sectionsStore.isCollapsed('folders')"
            @click="sectionsStore.toggleSection('folders')"
          >
            <span>Folders</span>
            <ChevronRightIcon v-if="sectionsStore.isCollapsed('folders')" class="w-4 h-4 ml-1" />
            <ChevronDownIcon
              v-else
              class="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          </button>
          <button
            type="button"
            class="ml-auto rounded-md p-1 hover:opacity-80"
            title="New folder"
            aria-label="New folder"
            @click="openNewFolderModal"
          >
            <PlusIcon class="w-4 h-4" />
          </button>
        </div>
        <draggable
          v-if="!sectionsStore.isCollapsed('folders')"
          :model-value="foldersStore.folders"
          @update:model-value="foldersStore.setFoldersOrder($event)"
          item-key="id"
          :group="foldersGroup"
          handle="[data-folder-handle]"
          :animation="150"
          ghost-class="opacity-40"
          class="min-h-[8px]"
        >
          <template #item="{ element: folder }">
            <div>
              <FolderMenuContext :folder="folder">
                <button
                  type="button"
                  data-folder-handle
                  class="group flex items-center w-full h-8 px-2 rounded-lg text-left cursor-pointer select-none text-sm transition-all hover:bg-black/5 dark:hover:bg-white/10"
                  :style="{
                    color: settingsStore.colors.foreground,
                  }"
                  :aria-expanded="!isFolderCollapsed(folder.id)"
                  @click="toggleFolder(folder.id)"
                  @dragover="onFolderHeaderDragOver(folder)"
                  @dragleave="onFolderHeaderDragLeave(folder, $event)"
                >
                  <FolderOpenIcon v-if="!isFolderCollapsed(folder.id)" class="w-4 h-4 mr-3 shrink-0 opacity-70" />
                  <FolderIcon v-else class="w-4 h-4 mr-3 shrink-0 opacity-70" />
                  <span class="truncate">{{ folder.name }}</span>
                  <ChevronRightIcon
                    v-if="isFolderCollapsed(folder.id)"
                    class="w-4 h-4 ml-auto shrink-0 opacity-0 group-hover:opacity-50"
                  />
                  <ChevronDownIcon v-else class="w-4 h-4 ml-auto shrink-0 opacity-0 group-hover:opacity-50" />
                </button>
              </FolderMenuContext>

              <div v-if="!isFolderCollapsed(folder.id)" class="ml-5">
                <draggable
                  :model-value="visibleFolderTabs(folder)"
                  @update:model-value="tabsStore.applyGroupOrder(folder.id, $event)"
                  @add="onWorkspaceAddedToFolder(folder.id)"
                  item-key="id"
                  :group="workspaceGroup"
                  :animation="150"
                  ghost-class="opacity-40"
                  class="min-h-[12px]"
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
                          sidebar
                          @click="openTab(tab)"
                          @mousedown.middle="requestCloseTab(tab.id)"
                        >
                          <span class="flex items-center text-sm truncate block min-w-0 flex-1">
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
      </div>

      <!-- Folders (collapsed sidebar) -->
      <draggable
        v-if="!settingsStore.isNavigationExpanded"
        :model-value="foldersStore.folders"
        @update:model-value="foldersStore.setFoldersOrder($event)"
        item-key="id"
        :group="foldersGroup"
        handle="[data-folder-tile]"
        :animation="150"
        ghost-class="opacity-40"
        class="space-y-2"
      >
        <template #item="{ element: folder }">
          <div class="space-y-2">
            <FolderMenuContext :folder="folder">
              <div
                data-folder-tile
                class="relative text-md flex h-8 w-8 justify-center capitalize items-center rounded-lg cursor-pointer hover:bg-black/10 transition-all"
                :class="{
                  'bg-black/10': !isFolderCollapsed(folder.id),
                }"
                :style="{
                  color: settingsStore.colors.foreground,
                }"
                @click="toggleFolder(folder.id)"
                v-tippy="{ content: `${folder.name} (${folderTabs(folder.id).length})`, placement: 'right' }"
              >
                <FolderOpenIcon v-if="!isFolderCollapsed(folder.id)" class="w-4 h-4" />
                <FolderIcon v-else class="w-4 h-4" />
                <span
                  v-if="folderTabs(folder.id).length > 0"
                  class="absolute -bottom-1 -right-1 min-w-[13px] h-[13px] px-[3px] rounded-full text-[8px] leading-[13px] text-center font-semibold text-white bg-primary-500 pointer-events-none select-none"
                >
                  {{ folderTabs(folder.id).length > 99 ? '99+' : folderTabs(folder.id).length }}
                </span>
              </div>
            </FolderMenuContext>

            <!-- Inline project tiles (folder open) -->
            <div v-if="!isFolderCollapsed(folder.id)" class="pl-1.5 space-y-2">
              <draggable
                :model-value="visibleFolderTabs(folder)"
                @update:model-value="tabsStore.applyGroupOrder(folder.id, $event)"
                @add="onWorkspaceAddedToFolder(folder.id)"
                item-key="id"
                :group="workspaceGroup"
                :animation="150"
                ghost-class="opacity-40"
                class="space-y-2 min-h-[12px]"
                :empty-insert-threshold="24"
                @start="onWorkspaceDragStart"
                @end="onWorkspaceDragEnd"
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

              <button
                v-if="hiddenCount(folder) > 0"
                @click="showMore(folder.id)"
                class="w-full"
                v-tippy="{ content: `Show more (+${nextStepCount(folder)})`, placement: 'right' }"
              >
                <ProjectTile tooltip="" tooltip-placement="right" :expanded="false">
                  <EllipsisHorizontalIcon class="w-4 h-4 flex-shrink-0 opacity-50" />
                </ProjectTile>
              </button>
            </div>
          </div>
        </template>
      </draggable>

      <!-- Recent workspaces (expanded sidebar) -->
      <div v-if="settingsStore.isNavigationExpanded" class="mt-3">
        <button
          type="button"
          class="group flex items-center w-full h-8 px-2 rounded-lg text-left text-sm font-medium opacity-50 hover:opacity-80 transition-opacity"
          :aria-expanded="!sectionsStore.isCollapsed('recent')"
          @click="sectionsStore.toggleSection('recent')"
        >
          <span>Recent</span>
          <ChevronRightIcon v-if="sectionsStore.isCollapsed('recent')" class="w-4 h-4 ml-1" />
          <ChevronDownIcon
            v-else
            class="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        </button>
        <draggable
          v-if="!sectionsStore.isCollapsed('recent')"
          :model-value="recentTabs"
          @update:model-value="tabsStore.applyGroupOrder(null, $event)"
          item-key="id"
          :group="workspaceGroup"
          :animation="150"
          ghost-class="opacity-40"
          class="min-h-[8px]"
          :empty-insert-threshold="24"
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
                  sidebar
                  @click="openTab(tab)"
                  @mousedown.middle="requestCloseTab(tab.id)"
                >
                  <span class="flex items-center text-sm truncate block min-w-0 flex-1">
                    <span class="truncate">{{ tab.name }}</span>
                  </span>
                </ProjectTile>
              </ProjectMenuContext>
            </div>
          </template>
        </draggable>
      </div>

      <!-- Recent workspaces (collapsed sidebar) -->
      <draggable
        v-if="!settingsStore.isNavigationExpanded && recentTabs.length > 0"
        :model-value="recentTabs"
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

      <!-- New folder -->
      <button
        v-if="!settingsStore.isNavigationExpanded"
        @click="openNewFolderModal()"
        v-tippy="{ content: 'New folder', placement: 'right' }"
      >
        <ProjectTile tooltip="" tooltip-placement="right" :expanded="false">
          <FolderPlusIcon class="w-4 h-4 flex-shrink-0 opacity-50" />
        </ProjectTile>
      </button>
    </div>
  </div>

  <NewFolderModal ref="newFolderModal" @created="onFolderCreated" />
</template>

<style scoped>
  .workspace-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--workspace-scrollbar-color) 35%, transparent) transparent;
  }

  .workspace-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .workspace-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .workspace-scrollbar::-webkit-scrollbar-thumb {
    background-color: color-mix(in srgb, var(--workspace-scrollbar-color) 35%, transparent);
    border: 0;
    border-radius: 9999px;
    background-clip: padding-box;
  }

  .workspace-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: color-mix(in srgb, var(--workspace-scrollbar-color) 55%, transparent);
  }
</style>
