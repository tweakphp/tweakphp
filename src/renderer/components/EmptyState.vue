<script setup lang="ts">
  const props = defineProps<{
    message: string
  }>()
</script>

<template>
  <div class="grid grid-cols-1 items-center">
    <div>{{ props.message }}</div>
  </div>
</template>
