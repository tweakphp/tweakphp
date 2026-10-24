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
  import SecondaryButton from '@/components/SecondaryButton.vue'
  import { PlusIcon } from '@heroicons/vue/24/outline'
  import SSHConnectModal from '../modals/SSHConnectModal.vue'
  import eventBus from '../../events'
  import FormField from '../forms/FormField.vue'

  const tabsStore = useTabsStore()
  const sshStore = useSSHStore()
  const emit = defineEmits(['connected'])

  const loading = ref<boolean>(false)
  const containers = ref<{ id: string; name: string; image: string }[]>([])
  const errorResponse = ref<string | null>(null)
  const phpVersion = ref<string | null>(null)
  const form = ref<ConnectionConfig>({
    type: 'docker',
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
      form.value = reply.connection
      form.value.ssh = undefined
      tab.docker = form.value
      tab.execution = form.value.type
      tabsStore.updateTab(tab)
    }
    emit('connected')
  }

  const selectDockerContainer = () => {
    if (!form.value.container_name) {
      return
    }

    getPHPVersion()
  }

  const getContainers = () => {
    phpVersion.value = ''
    containers.value = []
    loading.value = true
    form.value.container_name = ''

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
      return
    }
    errorResponse.value = ''
    actionReplyHandlers[reply.type as keyof typeof actionReplyHandlers](reply.result)
  }

  const actionReplyHandlers = {
    getContainers: (result: any) => {
      containers.value = result || []
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
    getContainers()

    const docker = tabsStore.getCurrent()?.docker
    if (docker) {
      form.value = docker
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
                id="docker-containers"
                v-model="form.ssh_id"
                @change="getContainers"
              >
                <option value="0">Local</option>
                <option v-for="conn in sshStore.connections" :key="`ssh-${conn.id}`" :value="conn.id">
                  {{ conn.name }}
                </option>
              </SelectInput>
            </div>
            <div>
              <SecondaryButton class="!h-7" v-tippy="{ content: 'Add Host' }" @click="sshConnectModal.openModal()">
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
            <div>
              <ArrowPathIcon
                :spin="true"
                @click="getContainers"
                :class="{ 'animate-spin': loading }"
                class="w-6 cursor-pointer h-6 hover:text-primary-500"
              />
            </div>
          </div>
        </FormField>

        <div class="space-y-3">
          <FormField label="PHP Version" divider>
            {{ phpVersion ?? '--' }}
          </FormField>

          <FormField label="Working directory" divider>
            <TextInput placeholder="/var/www/html" id="work_directory" v-model="form.working_directory" />
          </FormField>

          <FormField label="User" divider>
            <template #label> User <span class="text-xs text-gray-400">(optional)</span> </template>
            <TextInput placeholder="e.g. sail" id="docker_user" v-model="form.user" />
          </FormField>
        </div>

        <div class="mt-2">
          <span v-text="errorResponse" class="text-xs text-red-500"></span>
        </div>
      </div>
    </div>
    <SSHConnectModal ref="sshConnectModal" title="Add SSH Host" />
  </Container>
</template>

<style scoped></style>
