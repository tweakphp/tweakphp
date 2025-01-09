<script setup lang="ts">
  import { onMounted, onUnmounted, PropType, ref } from 'vue'
  import { Tab } from '../types/tab.type.ts'
  import DockerIcon from './icons/DockerIcon.vue'
  import { useTabsStore } from '../stores/tabs.ts'

  const tabsStore = useTabsStore()

  const connected = ref<boolean>(false)

  const props = defineProps({
    tab: {
      type: Object as PropType<Tab>,
      default: () => {
        return {}
      },
    },
  })

  const toggleDockerConnection = () => {
    if (!tabsStore.current) {
      return
    }

    const currentTab = tabsStore.current

    currentTab.docker.enable = !tabsStore.current.docker.enable

    connected.value = tabsStore.current.docker.enable

    tabsStore.updateTab(currentTab)
  }

  const handleDockerPHPVersionReply = (e: string) => {
    if (tabsStore.current?.docker.enable) {
      connected.value = e.toString() !== ''

      return
    }

    connected.value = false
  }

  const handleDockerPHPVersionReplyError = () => {
    connected.value = false
  }

  onMounted(() => {
    if (!props.tab.docker.container_name) {
      return
    }

    window.ipcRenderer.send('docker.php-version.info', {
      container_name: props.tab.docker.container_name,
    })

    window.ipcRenderer.on('docker.php-version.reply', handleDockerPHPVersionReply)
    window.ipcRenderer.on('docker.php-version.reply.error', handleDockerPHPVersionReplyError)
  })

  onUnmounted(() => {
    window.ipcRenderer.removeListener('docker.php-version.reply', handleDockerPHPVersionReply)
    window.ipcRenderer.removeListener('docker.php-version.reply.error', handleDockerPHPVersionReplyError)
  })
</script>

<template>
  <div>
    <div v-if="tab.docker.container_name" class="px-2 flex items-center gap-2">
      <DockerIcon
        :class="{ '!text-green-400': connected }"
        @click="toggleDockerConnection"
        class="w-4 text-red-500 cursor-pointer"
      />
      {{ tab.docker.container_name }}
    </div>
  </div>
</template>
