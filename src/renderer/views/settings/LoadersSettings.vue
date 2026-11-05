<script setup lang="ts">
  import Title from '../../components/Title.vue'
  import Divider from '../../components/Divider.vue'
  import { useLoadersStore } from '../../stores/loaders'
  import { ref } from 'vue'
  import PrimaryButton from '../../components/PrimaryButton.vue'
  import LoaderModal from '../../components/modals/LoaderModal.vue'
  import RowActions from '../../components/interactions/RowActions.vue'
  import EmptyState from '../../components/EmptyState.vue'

  const loadersStore = useLoadersStore()
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
      <PrimaryButton @click="add"> Write new loader </PrimaryButton>
    </div>
    <p class="mt-2 text-xs opacity-70">Manage custom loaders applied to your code before execution.</p>
    <Divider class="mt-3" />
    <div class="mx-auto space-y-3">
      <div v-if="Object.values(loadersStore.loaders).length > 0" class="space-y-3 mt-3">
        <template v-for="loader in loadersStore.loaders">
          <div class="grid grid-cols-2 gap-2 items-center">
            <div class="flex items-center">
              {{ loader.name }}
            </div>
            <RowActions @edit="edit(loader.name)" @remove="remove(loader.name)" />
          </div>
          <Divider />
        </template>
      </div>
      <EmptyState
        v-if="Object.values(loadersStore.loaders).length === 0"
        class="mt-3"
        message="No custom loader yet, click the button above to create one."
      />
    </div>
    <LoaderModal ref="loaderModal" :edit="editName" />
  </div>
</template>
