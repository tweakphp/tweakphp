<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import {
    ChevronDownIcon,
    FolderIcon,
    FolderOpenIcon,
    PlusIcon,
  } from '@heroicons/vue/24/outline'
  import draggable from 'vuedraggable'
  import { useTabsStore } from '../stores/tabs'
  import { useFoldersStore } from '../stores/folders'
  import { useSectionsStore } from '../stores/sections'
  import { useSettingsStore } from '../stores/settings'
  import SecondaryButton from './SecondaryButton.vue'
  import router from '../router'
  import events from '../events'
  import ProjectTile from './ProjectTile.vue'
  import AutoScrollText from './AutoScrollText.vue'
  import ProjectMenuContext from './contextMenus/ProjectMenuContext.vue'
  import FolderMenuContext from './contextMenus/FolderMenuContext.vue'
  import NewFolderModal from './modals/NewFolderModal.vue'
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

  // ---- collapse/expand animation ----
  // `height: auto` is not animatable in CSS, so these hooks measure the block
  // (scrollHeight) and drive an inline height: the `.collapse-*` classes in the
  // scoped style own the timing/easing and clip the block while it animates.
  const collapseEnter = (el: Element) => {
    const htmlEl = el as HTMLElement
    htmlEl.style.height = '0px'
    // force a reflow so the starting height is registered
    void htmlEl.offsetHeight
    htmlEl.style.height = `${htmlEl.scrollHeight}px`
  }

  const collapseAfterEnter = (el: Element) => {
    const htmlEl = el as HTMLElement
    htmlEl.style.height = ''
  }

  const collapseLeave = (el: Element) => {
    const htmlEl = el as HTMLElement
    htmlEl.style.height = `${htmlEl.scrollHeight}px`
    void htmlEl.offsetHeight
    htmlEl.style.height = '0px'
  }

  const collapseAfterLeave = (el: Element) => {
    const htmlEl = el as HTMLElement
    htmlEl.style.height = ''
  }

  // ---- actions ----
  const openTab = (tab: Tab) => {
    router.replace({ name: 'code', params: { id: tab.id } })
  }

  const requestArchiveTab = (id: number) => {
    events.dispatchEvent(new CustomEvent('tab.archive.request', { detail: id }))
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
  <div class="h-full min-h-0 flex flex-col p-1">
    <!-- Add new project -->
    <div class="shrink-0">
      <button @click="emit('open-new-project')" class="w-full">
        <ProjectTile expanded sidebar>
          <PlusIcon class="w-4 h-4 flex-shrink-0" />
          <span class="ml-3 text-sm truncate block min-w-0 flex-1"> Add new project </span>
        </ProjectTile>
      </button>
    </div>

    <div
      class="min-h-0 flex-1 overflow-y-auto workspace-scrollbar"
      :style="{ '--workspace-scrollbar-color': settingsStore.colors.foreground }"
    >
      <!-- Pinned workspaces -->
      <div v-if="pinnedTabs.length > 0" class="mt-3">
        <button
          type="button"
          class="group flex items-center w-full h-8 px-2 rounded-lg text-left text-sm font-medium opacity-50 transition-opacity enabled:hover:opacity-80"
          :aria-expanded="!sectionsStore.isCollapsed('pinned')"
          @click="sectionsStore.toggleSection('pinned')"
        >
          <span>Pinned</span>
          <ChevronDownIcon
            class="w-4 h-4 ml-1 transition-[transform,opacity] duration-200"
            :class="
              sectionsStore.isCollapsed('pinned')
                ? '-rotate-90'
                : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
            "
          />
        </button>
        <Transition
          name="collapse"
          @enter="collapseEnter"
          @after-enter="collapseAfterEnter"
          @leave="collapseLeave"
          @after-leave="collapseAfterLeave"
        >
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
                    expanded
                    sidebar
                    @click="openTab(tab)"
                    @mousedown.middle="requestArchiveTab(tab.id)"
                  >
                    <span class="flex items-center text-sm truncate block min-w-0 flex-1">
                      <span
                        v-if="tab.color || tab.tag"
                        v-tippy="{ content: tab.tag ?? null, placement: 'top' }"
                        class="size-2 rounded-full shrink-0 mr-2"
                        :class="tab.color ? `bg-${tab.color}-500` : 'border border-current opacity-70'"
                      ></span>
                      <AutoScrollText>{{ tab.name }}</AutoScrollText>
                    </span>
                  </ProjectTile>
                </ProjectMenuContext>
              </div>
            </template>
          </draggable>
        </Transition>
      </div>

      <!-- Folders -->
      <div class="mt-3">
        <div class="flex items-center h-8 pl-2 text-sm font-medium opacity-50">
          <button
            type="button"
            class="group flex items-center min-w-0 rounded-lg hover:opacity-80"
            :aria-expanded="!sectionsStore.isCollapsed('folders')"
            @click="sectionsStore.toggleSection('folders')"
          >
            <span>Folders</span>
            <ChevronDownIcon
              class="w-4 h-4 ml-1 transition-[transform,opacity] duration-200"
              :class="
                sectionsStore.isCollapsed('folders')
                  ? '-rotate-90'
                  : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
              "
            />
          </button>
          <SecondaryButton
            withoutBorder
            class="ml-auto !p-1"
            title="New folder"
            aria-label="New folder"
            @click="openNewFolderModal"
          >
            <PlusIcon class="w-4 h-4" />
          </SecondaryButton>
        </div>
        <Transition
          name="collapse"
          @enter="collapseEnter"
          @after-enter="collapseAfterEnter"
          @leave="collapseLeave"
          @after-leave="collapseAfterLeave"
        >
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
            <template #header>
              <div
                v-if="foldersStore.folders.length === 0"
                class="px-3 py-1 text-xs italic opacity-50"
                :style="{ color: settingsStore.colors.foreground }"
              >
                No folder found
              </div>
            </template>
            <template #item="{ element: folder }">
              <div>
                <FolderMenuContext :folder="folder">
                  <button
                    type="button"
                    data-folder-handle
                    class="group flex items-center w-full h-6 px-2 rounded-lg text-left cursor-pointer select-none text-sm transition-all hover:bg-black/5 dark:hover:bg-white/10"
                    :style="{
                      color: settingsStore.colors.foreground,
                    }"
                    :aria-expanded="!isFolderCollapsed(folder.id)"
                    @click="toggleFolder(folder.id)"
                    @dragover="onFolderHeaderDragOver(folder)"
                    @dragleave="onFolderHeaderDragLeave(folder, $event)"
                  >
                    <Transition name="folder-icon" mode="out-in">
                      <FolderOpenIcon
                        v-if="!isFolderCollapsed(folder.id)"
                        key="open"
                        class="w-4 h-4 mr-3 shrink-0 opacity-70"
                      />
                      <FolderIcon v-else key="closed" class="w-4 h-4 mr-3 shrink-0 opacity-70" />
                    </Transition>
                    <span class="truncate">{{ folder.name }}</span>
                    <ChevronDownIcon
                      class="w-4 h-4 ml-auto shrink-0 opacity-0 group-hover:opacity-50 transition-[transform,opacity] duration-200"
                      :class="{ '-rotate-90': isFolderCollapsed(folder.id) }"
                    />
                  </button>
                </FolderMenuContext>

                <Transition
                  name="collapse"
                  @enter="collapseEnter"
                  @after-enter="collapseAfterEnter"
                  @leave="collapseLeave"
                  @after-leave="collapseAfterLeave"
                >
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
                              expanded
                              sidebar
                              @click="openTab(tab)"
                              @mousedown.middle="requestArchiveTab(tab.id)"
                            >
                              <span class="flex items-center text-sm truncate block min-w-0 flex-1">
                                <span
                                  v-if="tab.color || tab.tag"
                                  v-tippy="{ content: tab.tag ?? null, placement: 'top' }"
                                  class="size-2 rounded-full shrink-0 mr-2"
                                  :class="tab.color ? `bg-${tab.color}-500` : 'border border-current opacity-70'"
                                ></span>
                                <AutoScrollText>{{ tab.name }}</AutoScrollText>
                              </span>
                            </ProjectTile>
                          </ProjectMenuContext>
                        </div>
                      </template>
                    </draggable>

                    <SecondaryButton
                      v-if="hiddenCount(folder) > 0"
                      class="!h-auto !w-full !min-w-0 !justify-start !border-transparent !px-3 !py-1 !text-xs text-start opacity-60 hover:opacity-100 hover:!text-primary-500"
                      @click="showMore(folder.id)"
                    >
                      Show more (+{{ nextStepCount(folder) }})
                    </SecondaryButton>
                    <SecondaryButton
                      v-else-if="(extraShown[folder.id] ?? 0) > 0"
                      class="!h-auto !w-full !min-w-0 !justify-start !border-transparent !px-3 !py-1 !text-xs text-start opacity-60 hover:opacity-100 hover:!text-primary-500"
                      @click="showLess(folder.id)"
                    >
                      Show less
                    </SecondaryButton>
                  </div>
                </Transition>
              </div>
            </template>
          </draggable>
        </Transition>
      </div>

      <!-- Recent workspaces -->
      <div class="mt-3">
        <button
          type="button"
          class="group flex items-center w-full h-6 px-2 rounded-lg text-left text-sm font-medium opacity-50 hover:opacity-80 transition-opacity"
          :aria-expanded="!sectionsStore.isCollapsed('recent')"
          @click="sectionsStore.toggleSection('recent')"
        >
          <span>Recent</span>
          <ChevronDownIcon
            class="w-4 h-4 ml-1 transition-[transform,opacity] duration-200"
            :class="
              sectionsStore.isCollapsed('recent')
                ? '-rotate-90'
                : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
            "
          />
        </button>
        <Transition
          name="collapse"
          @enter="collapseEnter"
          @after-enter="collapseAfterEnter"
          @leave="collapseLeave"
          @after-leave="collapseAfterLeave"
        >
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
            <template #header>
              <div
                v-if="recentTabs.length === 0"
                class="px-2 py-1 text-xs italic opacity-50"
                :style="{ color: settingsStore.colors.foreground }"
              >
                No project found
              </div>
            </template>
            <template #item="{ element: tab }">
              <div>
                <ProjectMenuContext :tab="tab">
                  <ProjectTile
                    :active="isActive(tab)"
                    :name="tab.name"
                    expanded
                    sidebar
                    @click="openTab(tab)"
                    @mousedown.middle="requestArchiveTab(tab.id)"
                  >
                    <span class="flex items-center text-sm truncate block min-w-0 flex-1">
                      <span
                        v-if="tab.color || tab.tag"
                        v-tippy="{ content: tab.tag ?? null, placement: 'top' }"
                        class="size-2 rounded-full shrink-0 mr-2"
                        :class="tab.color ? `bg-${tab.color}-500` : 'border border-current opacity-70'"
                      ></span>
                      <AutoScrollText>{{ tab.name }}</AutoScrollText>
                    </span>
                  </ProjectTile>
                </ProjectMenuContext>
              </div>
            </template>
          </draggable>
        </Transition>
      </div>
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

  /* Collapse/expand animation: the Transition JS hooks drive an inline height
     (height: auto is not animatable), these classes own timing/easing and clip
     the block while it animates. min-height: 0 lets droppable lists
     (min-h-[8px]/min-h-[12px]) fully collapse. pointer-events: none prevents
     Sortable drops into a container that is animating out. */
  .collapse-enter-active,
  .collapse-leave-active {
    transition:
      height 200ms ease-in-out,
      opacity 150ms ease-in-out;
    overflow: hidden;
    min-height: 0;
  }

  .collapse-enter-from,
  .collapse-leave-to {
    opacity: 0;
  }

  .collapse-leave-active {
    pointer-events: none;
  }

  /* Folder open/closed icon crossfade */
  .folder-icon-enter-active,
  .folder-icon-leave-active {
    transition: opacity 100ms ease-in-out;
  }

  .folder-icon-enter-from,
  .folder-icon-leave-to {
    opacity: 0;
  }
</style>
