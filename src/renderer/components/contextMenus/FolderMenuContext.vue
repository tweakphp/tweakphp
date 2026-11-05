<script setup lang="ts">
  import {
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuPortal,
    ContextMenuRoot,
    ContextMenuSeparator,
    ContextMenuTrigger,
  } from 'reka-ui'
  import { ref } from 'vue'
  import { useSettingsStore } from '../../stores/settings'
  import { useFoldersStore } from '../../stores/folders'
  import { useTabsStore } from '../../stores/tabs'
  import { WorkspaceFolder } from '../../../types/workspace-folder.type'
  import TrashIcon from '@/components/icons/TrashIcon.vue'
  import PencilIcon from '@/components/icons/PencilIcon.vue'
  import RenameFolderModal from '@/components/modals/RenameFolderModal.vue'
  import DeleteFolderModal from '@/components/modals/DeleteFolderModal.vue'

  const settingsStore = useSettingsStore()
  const foldersStore = useFoldersStore()
  const tabsStore = useTabsStore()

  const props = defineProps<{
    folder: WorkspaceFolder
  }>()

  const renameFolderModal = ref()
  const deleteFolderModal = ref()

  const hoverRename = ref(false)
  const hoverDelete = ref(false)
  const hoverDeleteWithTabs = ref(false)

  const openRenameModal = () => {
    renameFolderModal.value?.openModal()
  }

  const deleteFolder = () => {
    tabsStore.detachFolder(props.folder.id)
    foldersStore.deleteFolder(props.folder.id)
  }

  const confirmDeleteFolderWithTabs = () => {
    deleteFolderModal.value?.openModal()
  }
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        class="text-sm p-1 w-[200px] -ml-1 z-50 outline focus:!outline-primary-500 rounded-md grid grid-cols-1 gap-1 border shadow-lg"
        :style="{
          backgroundColor: settingsStore.colors.backgroundLight,
          color: settingsStore.colors.foreground,
          outlineColor: settingsStore.colors.border,
          borderColor: settingsStore.colors.border,
        }"
        :side-offset="5"
      >
        <ContextMenuItem
          value="Rename folder"
          @click="openRenameModal"
          @mouseover="hoverRename = true"
          @mouseleave="hoverRename = false"
          :class="['group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer']"
          :style="{
            color: settingsStore.colors.foreground,
            backgroundColor: hoverRename ? settingsStore.colors.background : settingsStore.colors.backgroundLight,
          }"
        >
          <div class="flex items-center justify-start gap-1">
            <PencilIcon class="w-3 h-3 shrink-0" />
            <span>Rename</span>
          </div>
        </ContextMenuItem>
        <ContextMenuSeparator class="h-[1px] border-t border-gray-200/20" />
        <ContextMenuItem
          value="Delete folder"
          @click="deleteFolder"
          @mouseover="hoverDelete = true"
          @mouseleave="hoverDelete = false"
          :class="['group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer']"
          :style="{
            color: settingsStore.colors.foreground,
            backgroundColor: hoverDelete ? settingsStore.colors.background : settingsStore.colors.backgroundLight,
          }"
        >
          <div class="flex items-center justify-start gap-1">
            <TrashIcon class="w-3 h-3 shrink-0" />
            <span>Delete folder (keep projects)</span>
          </div>
        </ContextMenuItem>
        <ContextMenuItem
          value="Delete folder with projects"
          @click="confirmDeleteFolderWithTabs"
          @mouseover="hoverDeleteWithTabs = true"
          @mouseleave="hoverDeleteWithTabs = false"
          :class="['group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer']"
          :style="{
            color: settingsStore.colors.foreground,
            backgroundColor: hoverDeleteWithTabs
              ? settingsStore.colors.background
              : settingsStore.colors.backgroundLight,
          }"
        >
          <div class="flex items-center justify-start gap-1">
            <TrashIcon class="w-3 h-3 shrink-0" />
            <span>Delete folder + projects</span>
          </div>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
  <RenameFolderModal ref="renameFolderModal" :folder="folder" />
  <DeleteFolderModal ref="deleteFolderModal" :folder="folder" />
</template>
