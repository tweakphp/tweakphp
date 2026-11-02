<script setup lang="ts">
  import { twMerge } from 'tailwind-merge'

  const props = defineProps({
    class: {
      type: String,
      default: '',
    },
    type: {
      type: String as () => 'button' | 'submit',
      default: 'button',
    },
  })
</script>

<template>
  <button
    :type="props.type"
    :class="
      twMerge(
        'inline-flex h-8 text-sm w-max min-w-max items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-1 text-white outline-0 transition hover:bg-primary-700 disabled:hover:bg-primary-600 focus:border-primary-300 focus:border-primary-700 focus:ring active:bg-primary-700 disabled:opacity-25 focus:border-primary-700 focus:ring-primary-700 focus:ring-opacity-40',
        props.class
      )
    "
  >
    <slot></slot>
  </button>
</template>

<style scoped></style>
