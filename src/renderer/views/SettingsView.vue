<script setup lang="ts">
  import { ref } from 'vue'
  import Container from '../components/Container.vue'
  import { useSettingsStore } from '../stores/settings'
  import GeneralSettings from './settings/GeneralSettings.vue'
  import LoadersSettings from './settings/LoadersSettings.vue'
  const settingsStore = useSettingsStore()
  const active = ref('general')
</script>

<template>
  <Container class="pt-[38px]">
    <div class="max-w-2xl mx-auto p-10">
      <ul class="w-full flex items-center py-3 border-b" :style="{ borderBottomColor: settingsStore.colors.border }">
        <li
          class="cursor-pointer hover:text-primary-500"
          :class="{ 'text-primary-500': active === 'general' }"
          @click="active = 'general'"
        >
          General
        </li>
        <li class="mx-3">|</li>
        <li
          class="cursor-pointer hover:text-primary-500"
          :class="{ 'text-primary-500': active === 'loaders' }"
          @click="active = 'loaders'"
        >
          Loaders
        </li>
      </ul>
      <div class="py-10">
        <GeneralSettings v-if="active === 'general'" />
        <LoadersSettings v-if="active === 'loaders'" />
      </div>
    </div>
  </Container>
</template>

<style scoped></style>
