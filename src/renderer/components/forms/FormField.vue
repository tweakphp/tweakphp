<script setup lang="ts">
  import Divider from '../Divider.vue'

  const props = withDefaults(
    defineProps<{
      label: string
      description?: string
      align?: 'center' | 'start'
      divider?: boolean
      dividerClass?: string
      labelClass?: string
    }>(),
    {
      description: '',
      align: 'center',
      divider: false,
      dividerClass: 'mt-3',
      labelClass: '',
    }
  )
</script>

<template>
  <div>
    <div class="grid grid-cols-2" :class="props.align === 'start' ? 'items-start' : 'items-center'">
      <div :class="props.labelClass">
        <slot name="label">{{ props.label }}</slot>
      </div>
      <div class="min-w-0">
        <slot />
        <p v-if="props.description" class="text-[11px] opacity-60 mt-1">{{ props.description }}</p>
      </div>
    </div>
    <Divider v-if="props.divider" :class="props.dividerClass" />
  </div>
</template>
