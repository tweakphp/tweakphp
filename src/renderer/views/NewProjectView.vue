<script setup lang="ts">
  import { onMounted, ref, Ref, watch } from 'vue'
  import { useHistoryStore } from '../stores/history'
  import { TrashIcon } from '@heroicons/vue/24/outline'
  import { useTabsStore } from '../stores/tabs'
  import Divider from '../components/Divider.vue'
  import { useSettingsStore } from '../stores/settings'
  import { Tab } from '../../types/tab.type'
  import { History } from '../../types/history.type'
  import TextInput from '../components/TextInput.vue'
  import SecondaryButton from '../components/SecondaryButton.vue'
  import ProjectTile from '../components/ProjectTile.vue'
  import router from '../router'

  const pathSplitter = window.platformInfo.getPlatform() === 'win32' ? '\\' : '/'
  const tabsStore = useTabsStore()
  const historyStore = useHistoryStore()
  const settingsStore = useSettingsStore()

  const emit = defineEmits(['opened'])
  const laravelHistory: History = { path: settingsStore.settings.laravelPath }
  const filter: Ref<string> = ref('')
  const history: Ref<History[]> = ref([laravelHistory].concat(historyStore.history))

  const addTab = (history: History) => {
    let tab: Tab = tabsStore.addTab({
      type: 'code',
      path: history.path,
    })

    tab.name = history.path.split(pathSplitter).pop() as string
    tabsStore.updateTab(tab)
    router.push({ name: 'code', params: { id: tab.id } })
    emit('opened')
  }

  onMounted(() => {})

  const openProject = () => {
    window.ipcRenderer.send('source.open')
  }

  const getHistoryName = (path: string) => {
    return path.split(pathSplitter).pop() as string
  }

  const removeHistory = (h: History) => {
    historyStore.removeHistory(h)
    history.value = historyStore.history.filter(history => {
      return history.path.toLowerCase().includes(filter.value.toLowerCase())
    })
  }

  watch(filter, newValue => {
    history.value = [laravelHistory].concat(historyStore.history).filter(history => {
      return history.path.toLowerCase().includes(newValue.toLowerCase())
    })
  })
</script>

<template>
  <div class="mt-3 w-full mx-auto">
    <div class="flex items-center justify-between">
      <TextInput id="filter" placeholder="Filter projects" v-model="filter" />
      <SecondaryButton @click="openProject">Open</SecondaryButton>
    </div>
    <Divider class="mt-3" />
    <div class="space-y-3 mt-3">
      <div class="flex items-center justify-between" v-for="h in history" :key="`history-${h.path}`">
        <button type="button" @click="addTab(h)" class="w-full flex items-start">
          <ProjectTile :expanded="false" :name="h.path"> {{ getHistoryName(h.path)[0] }} </ProjectTile>
          <div class="flex flex-col ml-2 items-start">
            <p class="text-xs capitalize">{{ getHistoryName(h.path) }}</p>
            <p class="text-[10px] opacity-40 mt-[1px] truncate w-[300px] text-left">{{ h.path }}</p>
          </div>
        </button>
        <button type="button" v-if="h.path !== settingsStore.settings.laravelPath">
          <TrashIcon @click="removeHistory(h)" class="w-4 h-4 hover:text-red-600" />
        </button>
      </div>
      <div v-if="history.length === 0">No projects found</div>
    </div>
  </div>
</template>
