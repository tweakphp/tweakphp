<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import Modal from './Modal.vue'
  import PrimaryButton from './PrimaryButton.vue'
  import SecondaryButton from './SecondaryButton.vue'
  import events from '../events'
  import { useTabsStore } from '../stores/tabs'
  import { useVaporStore } from '../stores/vapor'

  const tabsStore = useTabsStore()
  const vaporStore = useVaporStore()
  const closeTabModal = ref<InstanceType<typeof Modal> | null>(null)
  const tabPendingClose = ref<number | null>(null)
  const pendingTab = computed(() => (tabPendingClose.value ? tabsStore.findTab(tabPendingClose.value) : null))

  const nameTab = ref<string | null>(null)

  const closeTabRequestListener = (event: Event) => {
    const id = (event as CustomEvent<number>).detail
    tabPendingClose.value = id
    closeTabModal.value?.openModal()
  }

  const cancelCloseTab = () => {
    tabPendingClose.value = null
    closeTabModal.value?.closeModal()
  }

  const confirmCloseTab = async () => {
    const id = tabPendingClose.value
    if (id === null) {
      return
    }

    tabPendingClose.value = null
    closeTabModal.value?.closeModal()
    await tabsStore.removeTab(id)
    vaporStore.removeVaporConfig(id)
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
  <Modal title="Remove this tab" ref="closeTabModal" size="md">
    <div class="space-y-5">
      <p class="text-sm">
        Are you sure you want to remove
        <span class="font-semibold">{{ nameTab }}</span> tab?
      </p>
      <div class="flex justify-end gap-2">
        <SecondaryButton @click="cancelCloseTab">Cancel</SecondaryButton>
        <PrimaryButton @click="confirmCloseTab">Remove tab</PrimaryButton>
      </div>
    </div>
  </Modal>
</template>
