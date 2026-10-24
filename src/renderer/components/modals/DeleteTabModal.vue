<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import ConfirmModal from './ConfirmModal.vue'
  import events from '../../events'
  import { useTabsStore } from '../../stores/tabs'

  const tabsStore = useTabsStore()
  const confirmModal = ref<InstanceType<typeof ConfirmModal> | null>(null)
  const tabPendingClose = ref<number | null>(null)
  const pendingTab = computed(() => (tabPendingClose.value ? tabsStore.findTab(tabPendingClose.value) : null))

  const nameTab = ref<string | null>(null)

  const closeTabRequestListener = (event: Event) => {
    const id = (event as CustomEvent<number>).detail
    tabPendingClose.value = id
    confirmModal.value?.openModal()
  }

  const cancelCloseTab = () => {
    tabPendingClose.value = null
  }

  const confirmCloseTab = async () => {
    const id = tabPendingClose.value
    if (id === null) {
      return
    }

    tabPendingClose.value = null
    await tabsStore.removeTab(id)
  }

  watch(pendingTab, newTab => {
    if (newTab?.name) {
      nameTab.value = newTab.name
    }
  })

  onMounted(() => {
    events.addEventListener('tab.close.request', closeTabRequestListener)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('tab.close.request', closeTabRequestListener)
  })
</script>

<template>
  <ConfirmModal
    title="Remove this project"
    confirm-text="Remove project"
    ref="confirmModal"
    @confirm="confirmCloseTab"
    @cancel="cancelCloseTab"
  >
    <p>
      Are you sure you want to remove
      <span class="font-semibold">{{ nameTab }}</span> project?
    </p>
  </ConfirmModal>
</template>
