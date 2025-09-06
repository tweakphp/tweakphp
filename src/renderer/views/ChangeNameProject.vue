<script setup lang="ts">
  import { ref } from 'vue'
  import TextInput from '../components/TextInput.vue'
  import SecondaryButton from '../components/SecondaryButton.vue'
  import PrimaryButton from '../components/PrimaryButton.vue'
  import { Tab } from '../../types/tab.type.ts'
  import { useTabsStore } from '@/stores/tabs.ts'

  const tabsStore = useTabsStore()
  const emit = defineEmits(['opened'])

  const props = defineProps<{
    tab: Tab
  }>()

  const editedName = ref(props.tab.name)

  const handleSave = () => {
    if (editedName.value.trim()) {
      tabsStore.updateTabName(props.tab.id, editedName.value)
      emit('opened')
    }
  }

  const handleClose = () => {
    emit('opened')
  }
</script>

<template>
  <div>
    <div>
      <label for="tabName" class="block text-sm font-medium text-gray-300 mb-2">Tab Name</label>
      <TextInput
        class="w-full"
        id="tabName"
        v-model="editedName"
        @keyup.enter="handleSave"
        placeholder="Enter a new name"
      />
    </div>
    <div class="mt-6 flex justify-end space-x-3">
      <SecondaryButton @click="handleClose">Cancel</SecondaryButton>
      <PrimaryButton @click="handleSave">Save</PrimaryButton>
    </div>
  </div>
</template>
