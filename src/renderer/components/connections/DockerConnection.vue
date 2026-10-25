<script setup lang="ts">
  import Container from '../Container.vue'
  import { onMounted, ref, onBeforeUnmount } from 'vue'
  import ArrowPathIcon from '../icons/ArrowPathIcon.vue'
  import { useTabsStore } from '../../stores/tabs.ts'
  import SelectInput from '../SelectInput.vue'
  import TextInput from '../TextInput.vue'
  import { ConnectionConfig } from '../../../types/docker.type.ts'
  import { ConnectReply, ActionReply } from '../../../types/client.type.ts'
  import { useSSHStore } from '../../stores/ssh'
  import { useDockerStore } from '../../stores/docker'
  import SecondaryButton from '@/components/SecondaryButton.vue'
  import { PlusIcon } from '@heroicons/vue/24/outline'
  import SSHConnectModal from '../modals/SSHConnectModal.vue'
  import eventBus from '../../events'
  import FormField from '../forms/FormField.vue'

  const tabsStore = useTabsStore()
  const sshStore = useSSHStore()
  const dockerStore = useDockerStore()
  const emit = defineEmits(['connected'])

  const loading = ref<boolean>(false)
  const containers = ref<{ id: string; name: string; image: string }[]>([])
  const errorResponse = ref<string | null>(null)
  const phpVersion = ref<string | null>(null)
  const form = ref<ConnectionConfig>({
    type: 'docker',
    id: Date.now(),
    container_id: '',
    container_name: '',
    php_version: '',
    php_path: '',
    client_path: '',
    working_directory: '/var/www/html',
    ssh_id: 0,
    user: '',
  })
  const sshConnectModal = ref()
  const connecting = ref(false)
  let recheckSelection = false

  const connect = () => {
    const index = containers.value.findIndex(c => c.name === form.value.container_name)

    if (index === -1) {
      alert('Select a container first.')
      return
    }

    if (form.value.working_directory === '') {
      alert('Working directory is required.')
      document.getElementById('work_directory')?.focus()
      return
    }

    connecting.value = true
    window.ipcRenderer.send('client.connect', {
      connection: getConnection(),
      data: {
        state: 'connect-docker',
        setup: true,
      },
    })
  }

  const connectReply = (e: any) => {
    const reply = e.detail as ConnectReply
    if (reply.data?.state !== 'connect-docker') {
      return
    }
    if (reply.error) {
      errorResponse.value = reply.error
      return
    }
    errorResponse.value = ''
    let tab = tabsStore.getCurrent()
    if (tab) {
      const connected = reply.connection as ConnectionConfig
      connected.ssh = undefined
      connected.id = matchingDockerConnectionId(connected) ?? Date.now()
      connected.name = connected.container_name
      // Connections are atomic to a project: the docker connection belongs to this project
      connected.tab_id = tab.id
      form.value = connected

      // Persist the docker connection in the connections table (like ssh/kubectl)
      dockerStore.upsertConnection(connected)

      tab.execution = 'docker'
      tab.connection_id = String(connected.id)
      tabsStore.updateTab(tab)
    }
    emit('connected')
  }

  // Reuse the stored connection id when reconnecting to the same
  // container on the same host with the same working directory.
  // Connections are atomic to a project: only match this project's own.
  const matchingDockerConnectionId = (config: ConnectionConfig): number | null => {
    const match = dockerStore.connections.find(
      c =>
        c.tab_id === tabsStore.current?.id &&
        c.container_name === config.container_name &&
        String(c.ssh_id ?? 0) === String(config.ssh_id ?? 0) &&
        c.working_directory === config.working_directory
    )
    return match ? match.id : null
  }

  const selectDockerContainer = () => {
    if (!form.value.container_name) {
      return
    }

    getPHPVersion()
  }

  // Host changed: containers belong to a different host, so reset the selection
  const onHostChange = () => {
    phpVersion.value = ''
    containers.value = []
    form.value.container_name = ''
    fetchContainers()
  }

  // Manual refresh: keep the current selection and re-detect the PHP version afterwards
  const refreshContainers = () => {
    recheckSelection = true
    fetchContainers()
  }

  const fetchContainers = () => {
    loading.value = true

    window.ipcRenderer.send('client.action', {
      connection: getConnection(),
      type: 'getContainers',
    })
  }

  const getPHPVersion = () => {
    loading.value = true
    phpVersion.value = ''

    window.ipcRenderer.send('client.action', {
      connection: getConnection(),
      type: 'getPHPVersion',
    })
  }

  const actionReply = (e: any) => {
    const reply = e.detail as ActionReply
    loading.value = false
    if (reply.error) {
      errorResponse.value = reply.error
      if (reply.type === 'getContainers') {
        recheckSelection = false
      }
      return
    }
    errorResponse.value = ''
    actionReplyHandlers[reply.type as keyof typeof actionReplyHandlers](reply.result)
  }

  const actionReplyHandlers = {
    getContainers: (result: any) => {
      containers.value = result || []
      if (!recheckSelection) {
        return
      }
      recheckSelection = false
      if (form.value.container_name && containers.value.some(c => c.name === form.value.container_name)) {
        getPHPVersion()
      } else {
        form.value.container_name = ''
        phpVersion.value = ''
      }
    },
    getPHPVersion: (result: any) => {
      phpVersion.value = result
    },
  }

  const getConnection = () => {
    if (form.value.ssh_id) {
      form.value.ssh = sshStore.getConnection(form.value.ssh_id)
    }

    return JSON.parse(JSON.stringify(form.value))
  }

  onMounted(() => {
    fetchContainers()

    // Prefill from the project's stored docker connection (connection_id)
    const currentTab = tabsStore.getCurrent()
    const stored =
      currentTab?.connection_id != null
        ? dockerStore.connections.find(c => String(c.id) === currentTab.connection_id)
        : undefined
    if (stored) {
      form.value = { ...stored }
    }

    selectDockerContainer()

    eventBus.addEventListener('client.connect.reply', connectReply)
    eventBus.addEventListener('client.action.reply', actionReply)
  })

  onBeforeUnmount(() => {
    eventBus.removeEventListener('client.connect.reply', connectReply)
    eventBus.removeEventListener('client.action.reply', actionReply)
  })

  defineExpose({ connect, connecting })
</script>

<template>
  <Container>
    <div class="mt-3 w-full mx-auto">
      <div class="mx-auto space-y-3">
        <FormField label="Host" divider>
          <div class="flex gap-3 items-center">
            <div class="w-full">
              <SelectInput
                placeholder="Select docker host"
                id="docker-host"
                v-model="form.ssh_id"
                @change="onHostChange"
              >
                <option value="0">Local</option>
                <option v-for="conn in sshStore.connections" :key="`ssh-${conn.id}`" :value="conn.id">
                  {{ conn.name }}
                </option>
              </SelectInput>
            </div>
            <div>
              <SecondaryButton v-tippy="{ content: 'Add Host' }" @click="sshConnectModal.openModal()">
                <PlusIcon class="size-4" />
              </SecondaryButton>
            </div>
          </div>
        </FormField>

        <FormField label="Container" divider>
          <div class="flex gap-3 items-center">
            <div class="w-full">
              <SelectInput
                placeholder="Select container"
                id="docker-containers"
                v-model="form.container_name"
                @change="selectDockerContainer"
              >
                <option v-for="container in containers" :key="container.id" :value="container.name">
                  {{ container.name }}
                </option>
              </SelectInput>
            </div>
            <SecondaryButton @click="refreshContainers" v-tippy="{ content: 'Refresh containers' }">
              <ArrowPathIcon :spin="true" :class="{ 'animate-spin': loading }" class="size-6" />
            </SecondaryButton>
          </div>
        </FormField>

        <FormField label="PHP Version" divider>
          <span v-if="phpVersion" class="text-sm">{{ phpVersion }}</span>
          <span v-else-if="loading && form.container_name" class="text-sm opacity-50">Detecting…</span>
          <span v-else class="text-sm opacity-50">Select a container first</span>
        </FormField>

        <FormField label="Working directory" divider>
          <TextInput class="w-full" placeholder="/var/www/html" id="work_directory" v-model="form.working_directory" />
        </FormField>

        <FormField label="User" divider>
          <template #label> User <span class="text-xs text-gray-400">(optional)</span> </template>
          <TextInput class="w-full" placeholder="e.g. sail" id="docker_user" v-model="form.user" />
        </FormField>

        <div class="mt-2">
          <span v-text="errorResponse" class="text-xs text-red-500"></span>
        </div>
      </div>
    </div>
    <SSHConnectModal ref="sshConnectModal" title="Add SSH Host" />
  </Container>
</template>

<style scoped></style>
