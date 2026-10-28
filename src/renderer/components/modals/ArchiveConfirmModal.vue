<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref } from 'vue'
  import Modal from '../Modal.vue'
  import PrimaryButton from '../PrimaryButton.vue'
  import SecondaryButton from '../SecondaryButton.vue'
  import events from '../../events'
  import { useTabsStore } from '../../stores/tabs'
  import { useArchiveStore } from '../../stores/archive'

  const tabsStore = useTabsStore()
  const archiveStore = useArchiveStore()

  const modal = ref<InstanceType<typeof Modal> | null>(null)
  const pendingTabId = ref<number | null>(null)
  const pendingTabName = ref('')

  const archiveRequestListener = (event: Event) => {
    const id = (event as CustomEvent<number>).detail
    const tab = tabsStore.findTab(id)
    if (!tab) {
      return
    }

    pendingTabId.value = id
    pendingTabName.value = tab.name ?? ''
    modal.value?.openModal()
  }

  const onClosed = () => {
    pendingTabId.value = null
  }

  const closeAndReset = () => {
    modal.value?.closeModal()
    pendingTabId.value = null
  }

  const cancel = () => {
    closeAndReset()
  }

  const archive = async () => {
    const id = pendingTabId.value
    closeAndReset()
    if (id !== null) {
      await tabsStore.removeTab(id)
    }
  }

  const deletePermanently = async () => {
    const id = pendingTabId.value
    closeAndReset()
    if (id !== null) {
      await tabsStore.removeTab(id)
      await archiveStore.forceDelete(id)
    }
  }

  onMounted(() => {
    events.addEventListener('tab.archive.request', archiveRequestListener)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('tab.archive.request', archiveRequestListener)
  })
</script>

<template>
  <Modal ref="modal" title="Archive project" @closed="onClosed">
    <p>
      Are you sure you want to archive
      <span class="font-semibold">{{ pendingTabName }}</span> project?
    </p>
    <p class="mt-2 text-xs opacity-60">
      Archived projects stay in the Archive page and can be restored at any time. Deleting permanently removes the
      project and its connections: this cannot be undone.
    </p>
    <template #actions>
      <div class="flex justify-end gap-2">
        <SecondaryButton class="hover:!text-red-200 hover:bg-red-700" @click="deletePermanently">
          Delete permanently
        </SecondaryButton>
        <SecondaryButton @click="cancel">Cancel</SecondaryButton>
        <PrimaryButton @click="archive">Archive</PrimaryButton>
      </div>
    </template>
  </Modal>
</template>
