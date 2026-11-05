<script setup lang="ts">
  import { computed, ref, useSlots, type PropType } from 'vue'
  import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogRoot,
    DialogTitle,
    DialogTrigger,
  } from 'reka-ui'
  import type { FocusOutsideEvent, PointerDownOutsideEvent } from 'reka-ui'
  import { useSettingsStore } from '../stores/settings.ts'
  import { XMarkIcon } from '@heroicons/vue/24/outline'
  import SecondaryButton from '@/components/SecondaryButton.vue'
  import { ModalSize } from '../../types/modal.type'
  import { useModalActivity } from '../composables/useModalActivity'

  const settingsStore = useSettingsStore()
  const slots = useSlots()

  const props = defineProps({
    // Accessible title announced by screen readers when the dialog opens
    title: {
      type: String,
      default: '',
    },
    // Optional accessible description announced by screen readers
    description: {
      type: String,
      default: '',
    },
    size: {
      type: String as PropType<ModalSize>,
      default: ModalSize.MD,
      validator: (value: string) => Object.values(ModalSize).includes(value as ModalSize),
    },
    // Modal mode traps focus and renders the rest of the page inert.
    // Non-modal mode lets the user interact with the background.
    modal: {
      type: Boolean,
      default: true,
    },
    // Close the dialog when Escape is pressed
    closeOnEsc: {
      type: Boolean,
      default: true,
    },
    // Close the dialog when clicking outside of the content
    closeOnOutsideClick: {
      type: Boolean,
      default: true,
    },
    // Show the close (X) button in the top-right corner
    showCloseButton: {
      type: Boolean,
      default: true,
    },
  })

  const emit = defineEmits<{
    'update:open': [open: boolean]
    'opened': []
    'closed': []
    'escape-key-down': [event: KeyboardEvent]
    'pointer-down-outside': [event: PointerDownOutsideEvent]
    'focus-outside': [event: FocusOutsideEvent]
    'interact-outside': [event: PointerDownOutsideEvent | FocusOutsideEvent]
    'open-auto-focus': [event: Event]
    'close-auto-focus': [event: Event]
  }>()

  const isModalOpen = ref(false)
  useModalActivity(isModalOpen, () => props.modal)

  const openModal = () => {
    isModalOpen.value = true
  }

  const closeModal = () => {
    isModalOpen.value = false
  }

  const toggleModal = () => {
    isModalOpen.value = !isModalOpen.value
  }

  const onOpenChange = (open: boolean) => {
    isModalOpen.value = open
    emit('update:open', open)
    if (open) emit('opened')
    else emit('closed')
  }

  // DialogContent events: emitting them allows parents to react
  // or call event.preventDefault() to override the default behavior
  const onEscapeKeyDown = (event: KeyboardEvent) => {
    emit('escape-key-down', event)
    if (!props.closeOnEsc) event.preventDefault()
  }

  const onPointerDownOutside = (event: PointerDownOutsideEvent) => {
    emit('pointer-down-outside', event)
    // Ignore clicks on the overlay scrollbar so the dialog
    // is not closed unintentionally (see Reka "Scrollable overlay" example)
    const originalEvent = event.detail?.originalEvent
    if (originalEvent) {
      const target = originalEvent.target as HTMLElement
      if (originalEvent.offsetX > target.clientWidth || originalEvent.offsetY > target.clientHeight) {
        event.preventDefault()
      }
    }
    if (!props.closeOnOutsideClick) event.preventDefault()
  }

  const onFocusOutside = (event: FocusOutsideEvent) => emit('focus-outside', event)
  const onInteractOutside = (event: PointerDownOutsideEvent | FocusOutsideEvent) => emit('interact-outside', event)
  const onOpenAutoFocus = (event: Event) => emit('open-auto-focus', event)
  const onCloseAutoFocus = (event: Event) => emit('close-auto-focus', event)

  const hasDescription = computed(() => Boolean(props.description || slots.description))

  const sizeClasses: Record<ModalSize, string> = {
    [ModalSize.MD]: 'max-w-md',
    [ModalSize.LG]: 'max-w-lg',
    [ModalSize.XL]: 'max-w-xl',
    [ModalSize.TWO_XL]: 'max-w-2xl',
    [ModalSize.THREE_XL]: 'max-w-3xl',
    [ModalSize.FOUR_XL]: 'max-w-4xl',
    [ModalSize.FIVE_XL]: 'max-w-5xl',
  }

  defineExpose({ openModal, closeModal, toggleModal, isModalOpen })
</script>

<template>
  <DialogRoot :open="isModalOpen" :modal="props.modal" @update:open="onOpenChange">
    <DialogTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger"></slot>
    </DialogTrigger>

    <DialogPortal>
      <Transition
        appear
        enter-active-class="duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <DialogOverlay
          class="fixed inset-0 z-50 bg-black/25 transition"
          :class="{ 'pointer-events-none': !props.modal }"
        />
      </Transition>

      <div class="fixed inset-0 z-50 no-scrollbar pointer-events-none">
        <div class="flex min-h-full items-center justify-center p-4 text-center">
          <Transition
            appear
            enter-active-class="duration-300 ease-out"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="duration-200 ease-in"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <DialogContent
              v-bind="hasDescription ? {} : { 'aria-describedby': undefined }"
              class="pointer-events-auto relative my-8 w-full transform rounded-lg border p-6 text-left align-middle transition-all outline-none"
              :class="sizeClasses[props.size] ?? 'max-w-md'"
              :style="{
                backgroundColor: settingsStore.colors.background,
                color: settingsStore.colors.foreground,
                borderColor: settingsStore.colors.border,
              }"
              @escape-key-down="onEscapeKeyDown"
              @pointer-down-outside="onPointerDownOutside"
              @focus-outside="onFocusOutside"
              @interact-outside="onInteractOutside"
              @open-auto-focus="onOpenAutoFocus"
              @close-auto-focus="onCloseAutoFocus"
            >
              <DialogTitle
                as="h3"
                class="mb-5 flex items-center justify-between text-lg font-medium leading-6"
                :class="{ 'pr-8': props.showCloseButton }"
              >
                <slot name="title">{{ props.title }}</slot>
              </DialogTitle>

              <DialogDescription v-if="hasDescription" class="mb-4 text-sm opacity-70">
                <slot name="description">{{ props.description }}</slot>
              </DialogDescription>

              <DialogClose v-if="props.showCloseButton" as-child>
                <SecondaryButton without-border aria-label="Close" class="absolute right-2 top-2">
                  <XMarkIcon class="size-5" />
                  <span class="sr-only">Close</span>
                </SecondaryButton>
              </DialogClose>

              <div class="px-1">
                <slot></slot>
                <div class="mt-4">
                  <slot name="actions"></slot>
                </div>
              </div>
            </DialogContent>
          </Transition>
        </div>
      </div>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped></style>
