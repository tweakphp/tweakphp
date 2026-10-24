<script setup lang="ts">
  import { computed, ref } from 'vue'
  import Modal from '../Modal.vue'
  import SSHConnectForm from '../forms/SSHConnectForm.vue'
  import PrimaryButton from '../PrimaryButton.vue'
  import ArrowPathIcon from '../icons/ArrowPathIcon.vue'

  const props = withDefaults(
    defineProps<{
      id?: number
      title?: string
    }>(),
    {
      id: undefined,
      title: '',
    }
  )

  const modal = ref<InstanceType<typeof Modal> | null>(null)
  const form = ref<InstanceType<typeof SSHConnectForm> | null>(null)

  const modalTitle = computed(() => props.title || (props.id ? 'Edit Connection' : 'Add Connection'))

  const openModal = () => {
    modal.value?.openModal()
  }

  const closeModal = () => {
    modal.value?.closeModal()
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <Modal ref="modal" :title="modalTitle" size="lg">
    <SSHConnectForm ref="form" :id="props.id" @connected="closeModal()" />
    <template #actions>
      <div class="flex justify-end gap-2">
        <PrimaryButton @click="form?.connect()" :disabled="form?.connecting">
          <ArrowPathIcon
            v-if="form?.connecting"
            :spin="true"
            class="w-4 h-4 cursor-pointer hover:text-primary-500 animate-spin mr-1"
          />
          Connect
        </PrimaryButton>
      </div>
    </template>
  </Modal>
</template>
