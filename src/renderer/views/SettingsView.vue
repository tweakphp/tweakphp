<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import Container from '../components/Container.vue'
  import { useSettingsStore } from '../stores/settings'
  import GeneralSettings from './settings/GeneralSettings.vue'
  import LoadersSettings from './settings/LoadersSettings.vue'
  import { useRoute, useRouter } from 'vue-router'
  const settingsStore = useSettingsStore()
  const active = ref('')
  const router = useRouter()
  const route = useRoute()
  onMounted(() => {
    let params: any = route.params
    active.value = params.tab
  })
</script>

<template>
  <Container class="pt-[38px]">
    <div class="max-w-2xl mx-auto p-10">
      <ul class="w-full flex items-center py-3 border-b" :style="{ borderBottomColor: settingsStore.colors.border }">
        <li
          class="cursor-pointer hover:text-primary-500"
          :class="{ 'text-primary-500': !route.params.tab }"
          @click="router.push({ name: 'settings' })"
        >
          General
        </li>
        <li class="mx-3">|</li>
        <li
          class="cursor-pointer hover:text-primary-500"
          :class="{ 'text-primary-500': route.params.tab === 'loaders' }"
          @click="router.push({ name: 'settings', params: { tab: 'loaders' } })"
        >
          Loaders
        </li>
      </ul>
      <div class="py-10">
        <GeneralSettings v-if="!route.params.tab" />
        <LoadersSettings v-if="route.params.tab === 'loaders'" />
      </div>
    </div>
  </Container>
</template>

<style scoped></style>
