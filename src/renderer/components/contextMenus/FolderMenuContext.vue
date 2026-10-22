<script setup lang="ts">
  import {
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuPortal,
    ContextMenuRoot,
    ContextMenuSeparator,
    ContextMenuTrigger,
  } from 'reka-ui'
  import { computed, ref } from 'vue'
  import { useSettingsStore } from '../../stores/settings'
  import { useFoldersStore } from '../../stores/folders'
  import { useTabsStore } from '../../stores/tabs'
  import { WorkspaceFolder } from '../../../types/workspace-folder.type'
  import Modal from '@/components/Modal.vue'
  import TextInput from '@/components/TextInput.vue'
  import PrimaryButton from '@/components/PrimaryButton.vue'
  import SecondaryButton from '@/components/SecondaryButton.vue'
  import TrashIcon from '@/components/icons/TrashIcon.vue'
  import PencilIcon from '@/components/icons/PencilIcon.vue'

  const settingsStore = useSettingsStore()
  const foldersStore = useFoldersStore()
  const tabsStore = useTabsStore()

  const props = defineProps<{
    folder: WorkspaceFolder
  }>()

  const renameFolderModal = ref()
  const editedName = ref(props.folder.name)

  const deleteFolderModal = ref()

  const folderTabsCount = computed(() => tabsStore.tabs.filter(t => t.folder_id === props.folder.id).length)

  const hoverRename = ref(false)
  const hoverDelete = ref(false)
  const hoverDeleteWithTabs = ref(false)

  const openRenameModal = () => {
    editedName.value = props.folder.name
    renameFolderModal.value?.openModal()
  }

  const saveFolderName = () => {
    if (editedName.value.trim()) {
      foldersStore.renameFolder(props.folder.id, editedName.value)
    }
    renameFolderModal.value?.closeModal()
  }

  const deleteFolder = () => {
    tabsStore.detachFolder(props.folder.id)
    foldersStore.deleteFolder(props.folder.id)
  }

  const confirmDeleteFolderWithTabs = () => {
    deleteFolderModal.value?.openModal()
  }

  const deleteFolderWithTabs = async () => {
    deleteFolderModal.value?.closeModal()
    await tabsStore.removeFolderTabs(props.folder.id)
    foldersStore.deleteFolder(props.folder.id)
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
  <Modal title="Rename folder" ref="renameFolderModal" size="md">
    <div>
      <label for="folderName" class="block text-sm font-medium text-gray-300 mb-2">Folder Name</label>
      <TextInput
        class="w-full"
        id="folderName"
        v-model="editedName"
        @keyup.enter="saveFolderName"
        placeholder="Enter a new name"
      />
    </div>
    <div class="mt-6 flex justify-end space-x-3">
      <SecondaryButton @click="renameFolderModal.closeModal()">Cancel</SecondaryButton>
      <PrimaryButton @click="saveFolderName">Save</PrimaryButton>
    </div>
  </Modal>
  <Modal title="Delete folder" ref="deleteFolderModal" size="md">
    <div class="space-y-5">
      <p class="text-sm">
        Are you sure you want to delete
        <span class="font-semibold">{{ folder.name }}</span>
        <template v-if="folderTabsCount > 0">
          and its <span class="font-semibold">{{ folderTabsCount }}</span> project{{
            folderTabsCount === 1 ? '' : 's'
          }}?
        </template>
        <template v-else>?</template>
        This action cannot be undone.
      </p>
      <div class="flex justify-end gap-2">
        <SecondaryButton @click="deleteFolderModal.closeModal()">Cancel</SecondaryButton>
        <PrimaryButton @click="deleteFolderWithTabs">Delete</PrimaryButton>
      </div>
    </div>
  </Modal>
</template>
