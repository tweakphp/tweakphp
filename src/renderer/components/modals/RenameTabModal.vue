<script setup lang="ts">
  import { ref } from 'vue'
  import PromptModal from './PromptModal.vue'
  import { useTabsStore } from '../../stores/tabs'
  import { Tab } from '../../../types/tab.type'

  const tabsStore = useTabsStore()

  const props = defineProps<{
    tab: Tab
  }>()

  const promptModal = ref<InstanceType<typeof PromptModal> | null>(null)

  const openModal = () => {
    promptModal.value?.openModal()
  }

  const saveTabName = (name: string) => {
    tabsStore.updateTabName(props.tab.id, name)
  }

  defineExpose({ openModal })
</script>

<template>
  <PromptModal
    ref="promptModal"
    title="Change name"
    label="Tab Name"
    id="tabName"
    :initial-value="props.tab.name"
    placeholder="Enter a new name"
    confirm-text="Save"
    @confirm="saveTabName"
  />
</template>
