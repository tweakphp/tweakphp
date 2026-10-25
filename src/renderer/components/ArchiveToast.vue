<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import events from '../events'
  import { useTabsStore } from '../stores/tabs'
  import { useArchiveStore } from '../stores/archive'
  import UndoToast from './UndoToast.vue'

  /**
   * Global host for the archive flow: every "archive project" request (hover
   * button, context menu, middle click, Cmd+W) archives the project right
   * away and offers a timed undo through the reusable UndoToast. A new
   * request while a toast is pending simply confirms the previous archive
   * and restarts the toast for the new project.
   */
  const tabsStore = useTabsStore()
  const archiveStore = useArchiveStore()

  const showToast = ref(false)
  const toastKey = ref(0)
  const pendingTabId = ref<number | null>(null)
  const pendingTabName = ref('')

  const toastMessage = computed(() =>
    pendingTabName.value ? `"${pendingTabName.value}" moved to the archive.` : 'The project moved to the archive.'
  )

  const archiveTab = async (id: number) => {
    // capture the name before the tab leaves the store
    const tab = tabsStore.findTab(id)
    pendingTabId.value = id
    pendingTabName.value = tab?.name ?? ''
    showToast.value = false

    // removeTab archives the project: the tab leaves the store and the
    // save-all marks its row as trashed (soft delete, vapor config kept)
    await tabsStore.removeTab(id)

    toastKey.value++
    showToast.value = true
  }

  const undoArchive = async () => {
    const id = pendingTabId.value
    pendingTabId.value = null
    showToast.value = false
    if (id !== null) {
      await archiveStore.restore(id)
    }
  }

  const onExpired = () => {
    pendingTabId.value = null
    showToast.value = false
  }

  const archiveRequestListener = (event: Event) => {
    const id = (event as CustomEvent<number>).detail
    void archiveTab(id)
  }

  onMounted(() => {
    events.addEventListener('tab.archive.request', archiveRequestListener)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('tab.archive.request', archiveRequestListener)
  })
</script>

<template>
  <UndoToast
    v-if="showToast"
    :key="toastKey"
    title="Project archived"
    :message="toastMessage"
    action-label="Undo"
    :duration="7000"
    @action="undoArchive"
    @expired="onExpired"
  />
</template>
