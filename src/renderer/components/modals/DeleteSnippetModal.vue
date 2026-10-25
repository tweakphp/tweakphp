<script setup lang="ts">
  import { computed, ref } from 'vue'
  import ConfirmModal from './ConfirmModal.vue'
  import { useSnippetsStore } from '../../stores/snippets'
  import { Snippet } from '../../../types/snippet.type'

  const snippetsStore = useSnippetsStore()

  const props = defineProps<{
    snippet: Snippet | null
  }>()

  const emit = defineEmits<{
    (e: 'deleted'): void
  }>()

  const confirmModal = ref<InstanceType<typeof ConfirmModal> | null>(null)

  const snippetName = computed(() => (props.snippet?.title?.trim() ? props.snippet?.title : 'Untitled'))

  const openModal = () => {
    confirmModal.value?.openModal()
  }

  const deleteSnippet = async () => {
    if (!props.snippet?.id) {
      return
    }
    await snippetsStore.remove(props.snippet.id)
    emit('deleted')
  }

  defineExpose({ openModal })
</script>

<template>
  <ConfirmModal title="Delete snippet" confirm-text="Delete" ref="confirmModal" @confirm="deleteSnippet">
    <p>
      Are you sure you want to delete
      <span class="font-semibold">{{ snippetName }}</span
      >? This action cannot be undone.
    </p>
  </ConfirmModal>
</template>
