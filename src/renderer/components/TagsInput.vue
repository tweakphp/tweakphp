<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { TagsInputInput, TagsInputItem, TagsInputItemDelete, TagsInputItemText, TagsInputRoot } from 'radix-vue'
  import XCircleIcon from '@/components/icons/XCircleIcon.vue'
  import { useSettingsStore } from '../stores/settings'

  const settingsStore = useSettingsStore()

  const props = defineProps<{
    modelValue: string[]
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string[]): void
  }>()

  const localModelValue = ref<string[]>(props.modelValue || [])

  watch(props.modelValue, (newValue: string[]) => {
    localModelValue.value = newValue
  })

  watch(localModelValue, (newValue: string[]) => {
    emit('update:modelValue', newValue)
  })
</script>

<template>
  <TagsInputRoot
    v-model="localModelValue"
    class="flex gap-1 flex-wrap text-sm outline py-2 px-1 rounded-md"
    :style="{
      backgroundColor: settingsStore.colors.backgroundLight,
      color: settingsStore.colors.foreground,
      outlineColor: settingsStore.colors.border,
    }"
  >
    <TagsInputItem
      v-for="item in localModelValue"
      :key="item"
      :value="item"
      class="text-white border border-primary-500 flex shadow-md items-center justify-center gap-2 bg-green8 aria-[current=true]:bg-green9 rounded p-1"
    >
      <TagsInputItemText class="text-sm pl-1" />
      <TagsInputItemDelete class="p-0.5 rounded bg-transparent">
        <XCircleIcon class="size-4" />
      </TagsInputItemDelete>
    </TagsInputItem>

    <TagsInputInput
      class="text-sm focus:outline-none flex-1 rounded bg-transparent placeholder:text-mauve9 px-1"
      v-bind="$attrs"
    />
  </TagsInputRoot>
</template>
