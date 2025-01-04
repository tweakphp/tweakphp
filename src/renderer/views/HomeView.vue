<script setup lang="ts">
  import { onMounted, PropType, ref, Ref, watch } from 'vue'
  import { useHistoryStore } from '../stores/history'
  import { TrashIcon } from '@heroicons/vue/24/outline'
  import { useTabsStore } from '../stores/tabs'
  import Divider from '../components/Divider.vue'
  import { useSettingsStore } from '../stores/settings'
  import { Tab } from '../types/tab.type'
  import { History } from '../types/history.type'
  import TextInput from '../components/TextInput.vue'
  import SecondaryButton from '../components/SecondaryButton.vue'
  import ProjectTile from '../components/ProjectTile.vue'

  const tabsStore = useTabsStore()
  const historyStore = useHistoryStore()
  const settingsStore = useSettingsStore()

  const filter: Ref<string> = ref('')
  const history: Ref<History[]> = ref(historyStore.history)

  const props = defineProps({
    tab: {
      type: Object as PropType<Tab>,
      default: () => {
        return {}
      },
    },
  })

  const updateTab = (history: History) => {
    let tab: Tab = props.tab
    tab.type = 'code'
    tab.path = history.path
    tab.name = history.path.split('/').pop() as string
    tabsStore.updateTab(tab)
  }

  onMounted(() => {})

  const openProject = () => {
    window.ipcRenderer.send('source.open')
  }

  const getHistoryName = (path: string) => {
    return path.split('/').pop() as string
  }

  const removeHistory = (h: History) => {
    historyStore.removeHistory(h)
    history.value = historyStore.history.filter(history => {
      return history.path.toLowerCase().includes(filter.value.toLowerCase())
    })
  }

  watch(filter, newValue => {
    history.value = historyStore.history.filter(history => {
      return history.path.toLowerCase().includes(newValue.toLowerCase())
    })
  })
</script>

<template>
  <div class="max-w-2xl mx-auto p-10">
    <div class="flex items-center justify-between">
      <TextInput id="filter" placeholder="Filter projects" v-model="filter" />
      <SecondaryButton @click="openProject">Open</SecondaryButton>
    </div>
    <Divider class="mt-3" />
    <div class="space-y-3 mt-3">
      <div class="flex items-center justify-between">
        <button class="w-full flex items-center" @click="updateTab({ path: settingsStore.settings.laravelPath })">
          <ProjectTile name="Laravel"> l </ProjectTile>
          <div class="flex flex-col ml-2 items-start">
            <p class="text-xs capitalize">Laravel</p>
            <p class="text-[10px] opacity-40 mt-[1px] truncate w-[300px] text-left">
              {{ settingsStore.settings.laravelPath }}
            </p>
          </div>
        </button>
      </div>
      <div class="flex items-center justify-between" v-for="h in history" :key="`history-${h.path}`">
        <button @click="updateTab(h)" class="w-full flex items-start">
          <ProjectTile :name="h.path"> {{ getHistoryName(h.path)[0] }} </ProjectTile>
          <div class="flex flex-col ml-2 items-start">
            <p class="text-xs capitalize">{{ getHistoryName(h.path) }}</p>
            <p class="text-[10px] opacity-40 mt-[1px] truncate w-[300px] text-left">{{ h.path }}</p>
          </div>
        </button>
        <button>
          <TrashIcon @click="removeHistory(h)" class="w-4 h-4 hover:text-red-600" />
        </button>
      </div>
    </div>
  </div>
</template>
