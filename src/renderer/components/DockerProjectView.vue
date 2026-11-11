<script setup lang="ts">
  import { ref } from 'vue'
  import PrimaryButton from './PrimaryButton.vue'
  import ArrowPathIcon from './icons/ArrowPathIcon.vue'
  import DockerConnection from './connections/DockerConnection.vue'
  import { useTabsStore } from '../stores/tabs'
  import { useDockerStore } from '../stores/docker'
  import router from '../router'
  import { ConnectionConfig } from '../../types/docker.type'

  const tabsStore = useTabsStore()
  const dockerStore = useDockerStore()
  const form = ref<InstanceType<typeof DockerConnection> | null>(null)

  const emit = defineEmits(['opened'])

  const openRemoteProject = (connection: ConnectionConfig) => {
    const tab = tabsStore.addTab({
      type: 'code',
      name: connection.container_name,
      execution: 'docker',
    })
    // Connections are atomic to a project: persist the docker config for
    // this project and link it via connection_id
    connection.tab_id = tab.id
    dockerStore.upsertConnection(connection)
    tab.connection_id = String(connection.id)
    tabsStore.updateTab(tab)
    router.push({ name: 'code', params: { id: tab.id } })
    emit('opened')
  }
</script>

<template>
  <div class="mt-3 w-full mx-auto">
    <DockerConnection ref="form" :prefill-from-current-tab="false" @connected="openRemoteProject" />
    <div class="flex justify-end gap-2">
      <PrimaryButton @click="form?.connect()" :disabled="form?.connecting">
        <ArrowPathIcon
          v-if="form?.connecting"
          :spin="true"
          class="w-4 h-4 cursor-pointer hover:text-primary-500 animate-spin mr-1"
        />
        Connect
      </PrimaryButton>
    </div>
  </div>
</template>

<style scoped></style>
