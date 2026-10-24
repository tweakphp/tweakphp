<script setup lang="ts">
  import { computed, ref } from 'vue'
  import ConfirmModal from './ConfirmModal.vue'
  import { useFoldersStore } from '../../stores/folders'
  import { useTabsStore } from '../../stores/tabs'
  import { WorkspaceFolder } from '../../../types/workspace-folder.type'

  const foldersStore = useFoldersStore()
  const tabsStore = useTabsStore()

  const props = defineProps<{
    folder: WorkspaceFolder
  }>()

  const emit = defineEmits<{
    (e: 'deleted'): void
  }>()

  const confirmModal = ref<InstanceType<typeof ConfirmModal> | null>(null)

  const folderTabsCount = computed(() => tabsStore.tabs.filter(t => t.folder_id === props.folder.id).length)

  const openModal = () => {
    confirmModal.value?.openModal()
  }

  const deleteFolderWithTabs = async () => {
    await tabsStore.removeFolderTabs(props.folder.id)
    foldersStore.deleteFolder(props.folder.id)
    emit('deleted')
  }

  defineExpose({ openModal })
</script>

<template>
  <ConfirmModal title="Delete folder" confirm-text="Delete" ref="confirmModal" @confirm="deleteFolderWithTabs">
    <p>
      Are you sure you want to delete
      <span class="font-semibold">{{ folder.name }}</span>
      <template v-if="folderTabsCount > 0">
        and its <span class="font-semibold">{{ folderTabsCount }}</span> project{{ folderTabsCount === 1 ? '' : 's' }}?
      </template>
      <template v-else>?</template>
      This action cannot be undone.
    </p>
  </ConfirmModal>
</template>
