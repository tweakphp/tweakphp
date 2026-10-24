<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../Modal.vue'
  import { ModalSize } from '../../../types/modal.type'
  import Loader from '../Loader.vue'
  import PrimaryButton from '../PrimaryButton.vue'
  import ArrowPathIcon from '../icons/ArrowPathIcon.vue'

  const props = withDefaults(
    defineProps<{
      edit?: string
    }>(),
    {
      edit: '',
    }
  )

  const modal = ref<InstanceType<typeof Modal> | null>(null)
  const form = ref<InstanceType<typeof Loader> | null>(null)

  const openModal = () => {
    modal.value?.openModal()
  }

  const closeModal = () => {
    modal.value?.closeModal()
  }

  // when editing, the loader form stays open to allow further tweaks
  const onSaved = () => {
    if (!props.edit) {
      closeModal()
    }
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <Modal ref="modal" :title="props.edit ? 'Edit Loader' : 'Add Loader'" :size="ModalSize.FOUR_XL">
    <Loader ref="form" :edit="props.edit" @saved="onSaved" />
    <template #actions>
      <div class="flex items-center justify-end gap-2">
        <span :class="{ 'opacity-0': !form?.saved, 'opacity-65': form?.saved }" class="transition-all duration-300">
          Changes Saved
        </span>
        <PrimaryButton @click="form?.save()" :disabled="form?.saving">
          <ArrowPathIcon
            v-if="form?.saving"
            :spin="true"
            class="w-4 h-4 cursor-pointer hover:text-primary-500 animate-spin mr-1"
          />
          Save
        </PrimaryButton>
      </div>
    </template>
  </Modal>
</template>
