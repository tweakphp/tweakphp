<script setup lang="ts">
  import { computed, nextTick, ref } from 'vue'
  import { ToastAction, ToastDescription, ToastProvider, ToastRoot, ToastTitle, ToastViewport } from 'reka-ui'
  import { useSettingsStore } from '../stores/settings'
  import SecondaryButton from './SecondaryButton.vue'

  /**
   * Reusable toast with a timed undo action: the action is available for
   * `duration` milliseconds (countdown bar), then the toast auto-dismisses
   * and the operation is considered confirmed.
   *
   * Emits `action` when the user clicks the button, `expired` when the toast
   * goes away without the action being used (timeout or dismissed).
   */
  const props = withDefaults(
    defineProps<{
      title?: string
      message?: string
      actionLabel?: string
      duration?: number
    }>(),
    {
      title: '',
      message: '',
      actionLabel: 'Undo',
      duration: 7000,
    }
  )

  const emit = defineEmits<{
    action: []
    expired: []
  }>()

  const settingsStore = useSettingsStore()
  const open = ref(true)
  const actionTaken = ref(false)

  const countdownDuration = computed(() => `${props.duration}ms`)

  const onAction = () => {
    actionTaken.value = true
    open.value = false
    emit('action')
  }

  const onOpenChange = (value: boolean) => {
    open.value = value
    if (!value) {
      void nextTick().then(() => {
        if (!actionTaken.value) {
          emit('expired')
        }
      })
    }
  }
</script>

<template>
  <ToastProvider>
    <ToastRoot
      :open="open"
      :duration="props.duration"
      class="relative overflow-hidden rounded-lg border p-4 pb-5 shadow-sm"
      :style="{
        backgroundColor: settingsStore.colors.backgroundLight,
        borderColor: settingsStore.colors.border,
        color: settingsStore.colors.foreground,
      }"
      @update:open="onOpenChange"
    >
      <ToastTitle v-if="props.title" class="[grid-area:_title] font-medium text-base">
        {{ props.title }}
      </ToastTitle>
      <ToastDescription v-if="props.message" class="[grid-area:_description] text-sm break-words">
        {{ props.message }}
      </ToastDescription>
      <ToastAction as-child alt-text="Undo" class="[grid-area:_action] mt-2">
        <SecondaryButton class="!text-primary-500 hover:!text-primary-400" @click="onAction">
          {{ props.actionLabel }}
        </SecondaryButton>
      </ToastAction>
      <div
        class="undo-toast-progress absolute bottom-0 left-0 h-0.5 w-full bg-primary-500"
        :style="{ animationDuration: countdownDuration }"
        aria-hidden="true"
      ></div>
    </ToastRoot>
    <ToastViewport
      class="fixed bottom-0 right-0 flex flex-col py-8 px-3 gap-3 w-auto max-w-[400px] m-0 list-none z-[2147483647] outline-none"
    />
  </ToastProvider>
</template>

<style scoped>
  /* Countdown bar: depletes over the undo window. Linear timing so the
     remaining width matches the time left to take the action. */
  .undo-toast-progress {
    transform-origin: left;
    animation-name: undo-toast-countdown;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
  }

  @keyframes undo-toast-countdown {
    from {
      transform: scaleX(1);
    }
    to {
      transform: scaleX(0);
    }
  }
</style>
