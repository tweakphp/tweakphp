<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref } from 'vue'
  import ConfirmModal from './ConfirmModal.vue'
  import PrimaryButton from '../PrimaryButton.vue'
  import SecondaryButton from '../SecondaryButton.vue'
  import events from '../../events'
  import { useTabsStore } from '../../stores/tabs'
  import { useArchiveStore } from '../../stores/archive'

  /**
   * Global host for the archive flow: every "archive project" request (hover
   * button, context menu, middle click, Cmd+W) opens a confirmation modal
   * where the user either archives the project (soft delete, restorable from
   * the Archive page) or deletes it permanently. Nothing happens until a
   * choice is made: closing the modal keeps the project untouched.
   */
  const tabsStore = useTabsStore()
  const archiveStore = useArchiveStore()

  const modal = ref<InstanceType<typeof ConfirmModal> | null>(null)
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

  // Programmatic close (ConfirmModal's closeModal does not emit `closed`,
  // which only fires for reka-initiated closes: X, Esc, outside click). Every
  // close path must clear the id right away: the action buttons stay in the
  // DOM during the leave animation, and a stray click must not archive/delete
  // anything. The name is intentionally kept: it stays visible during the
  // close animation and is always refreshed by the next request before
  // reopening.
  const closeAndReset = () => {
    modal.value?.closeModal()
    pendingTabId.value = null
  }

  const cancel = () => {
    closeAndReset()
  }

  const onClosed = () => {
    pendingTabId.value = null
  }

  const archive = async () => {
    const id = pendingTabId.value
    closeAndReset()
    if (id !== null) {
      // removeTab archives the project: the tab leaves the store and the
      // save-all marks its row as trashed (soft delete, vapor config kept)
      await tabsStore.removeTab(id)
    }
  }

  const deletePermanently = async () => {
    const id = pendingTabId.value
    closeAndReset()
    if (id !== null) {
      // removeTab takes the project out of the store first (navigation
      // handled), then forceDelete wipes the row and its connections and
      // broadcasts the resync
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
  <ConfirmModal ref="modal" title="Archive project" @closed="onClosed">
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
  </ConfirmModal>
</template>
