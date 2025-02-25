<script setup lang="ts">
  import Title from '../../components/Title.vue'
  import Divider from '../../components/Divider.vue'
  import { useLodaersStore } from '../../stores/loaders'
  import { ref } from 'vue'
  import PrimaryButton from '../../components/PrimaryButton.vue'
  import { PencilIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
  import Modal from '../../components/Modal.vue'
  import Loader from '../../components/Loader.vue'

  const loadersStore = useLodaersStore()
  const editName = ref('')
  const loaderModal = ref()

  const add = () => {
    editName.value = ''
    loaderModal.value.openModal()
  }

  const edit = (name: string) => {
    editName.value = name
    loaderModal.value.openModal()
  }

  const remove = (name: string) => {
    if (confirm('Are you sure you want to remove it?')) {
      loadersStore.remove(name)
    }
  }
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <Title>Loaders</Title>
      <PrimaryButton @click="add">
        <PlusIcon class="w-4 h-4" />
      </PrimaryButton>
    </div>
    <Divider class="mt-3" />
    <div class="mx-auto space-y-3">
      <div v-if="Object.values(loadersStore.loaders).length > 0" class="space-y-3 mt-3">
        <template v-for="loader in loadersStore.loaders">
          <div class="grid grid-cols-2 gap-2 items-center">
            <div class="flex items-center">
              {{ loader.name }}
            </div>
            <div class="flex gap-1 justify-end space-x-2">
              <button type="button" @click="edit(loader.name)" class="p-1 cursor-pointer">
                <PencilIcon v-tippy="'Edit'" class="size-4 hover:text-blue-500" />
              </button>
              <button type="button" @click="remove(loader.name)" class="p-1 cursor-pointer">
                <TrashIcon v-tippy="'Delete'" class="size-4 hover:text-red-500" />
              </button>
            </div>
          </div>
          <Divider />
        </template>
      </div>
      <div v-if="Object.values(loadersStore.loaders).length === 0" class="grid grid-cols-1 items-center mt-3">
        <div>No custom loader yet!</div>
      </div>
    </div>
    <Modal ref="loaderModal" :title="editName ? 'Edit Loader' : 'Add Loader'" size="4xl">
      <Loader :edit="editName" @saved="() => (!editName ? loaderModal.closeModal() : () => {})" />
    </Modal>
  </div>
</template>
