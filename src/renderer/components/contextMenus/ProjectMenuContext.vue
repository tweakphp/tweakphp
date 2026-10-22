<script setup lang="ts">
  import { useSettingsStore } from '../../stores/settings'
  import { useTabsStore } from '../../stores/tabs'
  import { useFoldersStore } from '../../stores/folders'
  import {
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuPortal,
    ContextMenuRoot,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
  } from 'reka-ui'
  import { computed, ref } from 'vue'
  import Modal from '@/components/Modal.vue'
  import ChangeNameProject from '@/views/ChangeNameProject.vue'
  const changeNameProject = ref()
  import { Tab } from '../../../types/tab.type'
  import { WorkspaceFolder } from '../../../types/workspace-folder.type'
  import TrashIcon from '@/components/icons/TrashIcon.vue'
  import PencilIcon from '@/components/icons/PencilIcon.vue'
  import events from '../../events'
  import { DocumentDuplicateIcon, FolderIcon, FolderPlusIcon, StarIcon } from '@heroicons/vue/24/outline'
  import NewFolderModal from '@/components/NewFolderModal.vue'

  const settingsStore = useSettingsStore()
  const tabsStore = useTabsStore()
  const foldersStore = useFoldersStore()

  const props = defineProps<{
    tab: Tab
  }>()

  const lastFolderName = computed(() => {
    const pathParts = (props.tab.path ?? '').split(/[/\\]/)
    return pathParts[pathParts.length - 1] || null
  })

  function openModalChangeName() {
    changeNameProject.value.openModal()
  }

  function goToFolder() {
    window.ipcRenderer.send('source.openPath', props.tab.path)
  }

  function removeTab() {
    events.dispatchEvent(new CustomEvent('tab.close.request', { detail: props.tab.id }))
  }

  function togglePin() {
    tabsStore.togglePin(props.tab.id)
  }

  function duplicateTab() {
    tabsStore.duplicateTab(props.tab.id)
  }

  function moveToFolder(folderId: number | null) {
    tabsStore.moveTab(props.tab.id, folderId, 0)
  }

  const newFolderModal = ref()

  function openNewFolderModal() {
    newFolderModal.value?.openModal()
  }

  function onFolderCreated(folder: WorkspaceFolder) {
    tabsStore.moveTab(props.tab.id, folder.id, 0)
    // the new folder is created collapsed, like every other new folder
    foldersStore.collapseFolder(folder.id)
  }

  const hoverChangeName = ref(false)
  const hoverGoToFolder = ref(false)
  const hoverRemoveTab = ref(false)
  const hoverPin = ref(false)
  const hoverNoFolder = ref(false)
  const hoverDuplicate = ref(false)
  const hoverNewFolder = ref(false)
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
          value="Change Name"
          @click="openModalChangeName"
          @mouseover="hoverChangeName = true"
          @mouseleave="hoverChangeName = false"
          :class="['group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer']"
          :style="{
            color: settingsStore.colors.foreground,
            backgroundColor: hoverChangeName ? settingsStore.colors.background : settingsStore.colors.backgroundLight,
          }"
        >
          <div class="flex items-center justify-start gap-1">
            <PencilIcon class="w-3 h-3 shrink-0" />
            <span>Change name</span>
          </div>
        </ContextMenuItem>
        <ContextMenuItem
          value="Pin"
          @click="togglePin"
          @mouseover="hoverPin = true"
          @mouseleave="hoverPin = false"
          :class="['group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer']"
          :style="{
            color: settingsStore.colors.foreground,
            backgroundColor: hoverPin ? settingsStore.colors.background : settingsStore.colors.backgroundLight,
          }"
        >
          <div class="flex items-center justify-start gap-1">
            <StarIcon class="w-3 h-3 shrink-0" />
            <span>{{ props.tab.pinned ? 'Unpin' : 'Pin' }}</span>
          </div>
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger
            value="Move to folder"
            class="group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer data-[highlighted]:bg-black/10"
            :style="{
              color: settingsStore.colors.foreground,
            }"
          >
            <div class="flex items-center justify-start gap-1">
              <FolderIcon class="w-3 h-3 shrink-0" />
              <span>Move to folder</span>
            </div>
          </ContextMenuSubTrigger>
          <ContextMenuPortal>
            <ContextMenuSubContent
              class="text-sm p-1 w-[200px] z-50 outline focus:!outline-primary-500 rounded-md grid grid-cols-1 gap-1 border shadow-lg"
              :style="{
                backgroundColor: settingsStore.colors.backgroundLight,
                color: settingsStore.colors.foreground,
                outlineColor: settingsStore.colors.border,
                borderColor: settingsStore.colors.border,
              }"
              :side-offset="2"
              :align-offset="-5"
            >
              <ContextMenuItem
                value="new-folder"
                @click="openNewFolderModal"
                @mouseover="hoverNewFolder = true"
                @mouseleave="hoverNewFolder = false"
                class="group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer"
                :style="{
                  color: settingsStore.colors.foreground,
                  backgroundColor: hoverNewFolder
                    ? settingsStore.colors.background
                    : settingsStore.colors.backgroundLight,
                }"
              >
                <FolderPlusIcon class="w-3 h-3 shrink-0 mr-1.5" />
                <span>New folder…</span>
              </ContextMenuItem>
              <ContextMenuSeparator
                v-if="foldersStore.folders.length > 0"
                class="h-[1px] border-t border-gray-200/20"
              />
              <ContextMenuItem
                v-for="folder in foldersStore.folders"
                :key="folder.id"
                :value="`folder-${folder.id}`"
                :disabled="props.tab.folder_id === folder.id"
                @click="moveToFolder(folder.id)"
                class="group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer data-[highlighted]:bg-black/10"
                :style="{
                  color: settingsStore.colors.foreground,
                  opacity: props.tab.folder_id === folder.id ? 0.4 : 1,
                }"
              >
                <FolderIcon class="w-3 h-3 shrink-0 mr-1.5 opacity-70" />
                <span class="truncate">{{ folder.name }}</span>
              </ContextMenuItem>
              <ContextMenuSeparator
                v-if="foldersStore.folders.length > 0 && props.tab.folder_id"
                class="h-[1px] border-t border-gray-200/20"
              />
              <ContextMenuItem
                v-if="props.tab.folder_id"
                value="no-folder"
                @click="moveToFolder(null)"
                @mouseover="hoverNoFolder = true"
                @mouseleave="hoverNoFolder = false"
                class="group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer"
                :style="{
                  color: settingsStore.colors.foreground,
                  backgroundColor: hoverNoFolder
                    ? settingsStore.colors.background
                    : settingsStore.colors.backgroundLight,
                }"
              >
                <span>No folder</span>
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuPortal>
        </ContextMenuSub>
        <ContextMenuItem
          value="Duplicate"
          @click="duplicateTab"
          @mouseover="hoverDuplicate = true"
          @mouseleave="hoverDuplicate = false"
          :class="['group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer']"
          :style="{
            color: settingsStore.colors.foreground,
            backgroundColor: hoverDuplicate ? settingsStore.colors.background : settingsStore.colors.backgroundLight,
          }"
        >
          <div class="flex items-center justify-start gap-1">
            <DocumentDuplicateIcon class="w-3 h-3 shrink-0" />
            <span>Duplicate</span>
          </div>
        </ContextMenuItem>
        <ContextMenuItem
          value="Go to folder"
          @click="goToFolder"
          @mouseover="hoverGoToFolder = true"
          @mouseleave="hoverGoToFolder = false"
          :class="['group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer']"
          :style="{
            color: settingsStore.colors.foreground,
            backgroundColor: hoverGoToFolder ? settingsStore.colors.background : settingsStore.colors.backgroundLight,
          }"
        >
          Go to folder<span v-if="lastFolderName">&nbsp;"{{ lastFolderName }}"</span>
        </ContextMenuItem>
        <ContextMenuSeparator class="h-[1px] border-t border-gray-200/20" />
        <ContextMenuItem
          value="Remove project"
          @click="removeTab"
          @mouseover="hoverRemoveTab = true"
          @mouseleave="hoverRemoveTab = false"
          :class="['group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer']"
          :style="{
            color: settingsStore.colors.foreground,
            backgroundColor: hoverRemoveTab ? settingsStore.colors.background : settingsStore.colors.backgroundLight,
          }"
        >
          <div class="flex items-center justify-start gap-1">
            <TrashIcon class="w-3 h-3 shrink-0" />
            <span>Remove</span>
          </div>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
  <Modal title="Change name" ref="changeNameProject" size="xl">
    <ChangeNameProject @opened="changeNameProject.closeModal()" :tab="tab" />
  </Modal>
  <NewFolderModal ref="newFolderModal" @created="onFolderCreated" />
</template>
