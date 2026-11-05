<script setup lang="ts">
  import { PencilIcon, TrashIcon } from '@heroicons/vue/24/outline'
  import SecondaryButton from '../SecondaryButton.vue'

  withDefaults(
    defineProps<{
      editLabel?: string
      removeLabel?: string
    }>(),
    {
      editLabel: 'Edit',
      removeLabel: 'Delete',
    }
  )

  defineEmits<{
    (e: 'edit'): void
    (e: 'remove'): void
  }>()
</script>

<template>
  <div class="flex gap-1 justify-end space-x-2">
    <SecondaryButton
      class="!p-1 !border-transparent"
      :aria-label="editLabel"
      v-tippy="editLabel"
      @click="$emit('edit')"
    >
      <PencilIcon class="size-4 hover:text-primary-500" />
    </SecondaryButton>
    <SecondaryButton
      class="!p-1 !border-transparent"
      :aria-label="removeLabel"
      v-tippy="removeLabel"
      @click="$emit('remove')"
    >
      <TrashIcon class="size-4 hover:text-red-500" />
    </SecondaryButton>
    <slot />
  </div>
</template>
