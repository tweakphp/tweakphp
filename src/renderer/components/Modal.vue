<script setup lang="ts">
  import { ref } from 'vue'
  import { TransitionRoot, TransitionChild, DialogPanel, DialogTitle, Dialog } from '@headlessui/vue'
  import { useSettingsStore } from '../stores/settings.ts'
  import { XMarkIcon } from '@heroicons/vue/24/outline'

  const settingsStore = useSettingsStore()

  const props = defineProps({
    title: {
      type: String,
      default: '',
    },
    size: {
      type: String,
      default: 'md',
    },
  })

  const isModalOpen = ref(false)
  const closeModal = () => {
    isModalOpen.value = false
  }

  const openModal = () => {
    isModalOpen.value = true
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <div>
    <TransitionRoot appear :show="isModalOpen" as="template">
      <Dialog as="div" @close="closeModal" class="relative z-50">
        <TransitionChild
          as="template"
          enter="duration-300 ease-out"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="duration-200 ease-in"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-black/25" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-y-auto no-scrollbar">
          <div class="flex min-h-full items-start justify-center p-4 text-center mt-20">
            <TransitionChild
              as="template"
              enter="duration-300 ease-out"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="duration-200 ease-in"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel
                class="w-full transform rounded-lg p-6 text-left align-middle transition-all border"
                :class="{
                  'max-w-md': props.size === 'md',
                  'max-w-lg': props.size === 'lg',
                  'max-w-xl': props.size === 'xl',
                  'max-w-2xl': props.size === '2xl',
                  'max-w-3xl': props.size === '3xl',
                  'max-w-4xl': props.size === '4xl',
                  'max-w-5xl': props.size === '5xl',
                }"
                :style="{
                  backgroundColor: settingsStore.colors.background,
                  color: settingsStore.colors.foreground,
                  borderColor: settingsStore.colors.border,
                }"
              >
                <DialogTitle as="h3" class="text-lg font-medium leading-6 mb-5 flex items-center justify-between">
                  {{ props.title }}
                  <XMarkIcon class="w-5 h-5 cursor-pointer hover:opacity-70" @click="closeModal()" />
                </DialogTitle>
                <slot></slot>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </div>
</template>

<style scoped></style>
