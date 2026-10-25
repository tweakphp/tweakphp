<script lang="ts" setup>
  import { ArrowPathIcon, BoltIcon, ChevronDownIcon, FolderIcon, ServerIcon } from '@heroicons/vue/24/outline'
  import SecondaryButton from './SecondaryButton.vue'
  import DockerIcon from './icons/DockerIcon.vue'
  import KubectlIcon from './icons/KubectlIcon.vue'
  import VaporIcon from './icons/VaporIcon.vue'
  import { useTabsStore } from '../stores/tabs'
  import DropDown from './DropDown.vue'
  import DropDownItem from './DropDownItem.vue'
  import { computed, ComputedRef, onBeforeUnmount, onMounted, ref } from 'vue'
  import { useSettingsStore } from '../stores/settings'
  import { Tab } from '../../types/tab.type'
  import { useSSHStore } from '../stores/ssh'
  import events from '../events'
  import { useKubectlStore } from '../stores/kubectl'
  import { ConnectReply } from '../../types/client.type'
  import { useLoadersStore } from '../stores/loaders'
  import { useVaporStore } from '../stores/vapor.ts'
  import { useConnectionsStore } from '../stores/connections.ts'
  import Divider from './Divider.vue'
  import { useRouter } from 'vue-router'
  import DockerConnectModal from './modals/DockerConnectModal.vue'
  import SSHConnectionsModal from './modals/SSHConnectionsModal.vue'
  import KubectlConnectionsModal from './modals/KubectlConnectionsModal.vue'
  import { useDockerStore } from '../stores/docker.ts'

  const tabStore = useTabsStore()
  const settingsStore = useSettingsStore()
  const sshStore = useSSHStore()
  const kubectlStore = useKubectlStore()
  const loadersStore = useLoadersStore()
  const vaporStore = useVaporStore()
  const dockerStore = useDockerStore()
  const connectionsStore = useConnectionsStore()
  const router = useRouter()
  const dockerModal = ref()
  const sshModal = ref()
  const kubectlModal = ref()
  const tab: ComputedRef<Tab | null> = computed(() => tabStore.getCurrent())
  const sshConnecting = ref(false)
  const kubectlConnecting = ref(false)
  const connecting = ref('')

  onMounted(() => {
    events.addEventListener('client.connect.reply', connectReply)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('client.connect.reply', connectReply)
  })

  const connect = (execution: string) => {
    if (!tabStore.current) {
      return
    }

    if (execution !== 'vapor') {
      vaporStore.removeEnvironment(tabStore.current.id)
    }

    connecting.value = execution
    let connection = tabStore.getConnectionConfig(tabStore.current, execution)
    window.ipcRenderer.send('client.connect', {
      connection: JSON.parse(JSON.stringify(connection)),
      data: {
        state: 'reconnect',
        setup: true,
      },
    })
  }

  const connectReply = (e: any) => {
    const reply = e.detail as ConnectReply
    if (reply.data?.state !== 'reconnect') {
      return
    }
    let execution = connecting.value
    connecting.value = ''
    if (reply.error) {
      alert(reply.error)
      return
    }
    if (!tabStore.current) {
      return
    }

    // Re-persist the enriched connection (php / client_path detected during
    // connect) so the discovered values survive restarts
    if (execution === 'ssh' && reply.connection?.id) {
      sshStore.updateConnection(reply.connection.id, reply.connection)
    }
    if (execution === 'kubectl' && reply.connection?.id) {
      kubectlStore.updateConnection(reply.connection.id, reply.connection)
    }
    if (execution === 'docker' && reply.connection?.container_name) {
      const connected = reply.connection
      connected.ssh = undefined
      // Connections are atomic to a project: match only this project's own
      const match = dockerStore.connections.find(
        c =>
          c.tab_id === tabStore.current?.id &&
          c.container_name === connected.container_name &&
          String(c.ssh_id ?? 0) === String(connected.ssh_id ?? 0) &&
          c.working_directory === connected.working_directory
      )
      connected.id = match?.id ?? Date.now()
      connected.name = connected.container_name
      connected.tab_id = tabStore.current.id
      dockerStore.upsertConnection(connected)
      tabStore.current.connection_id = String(connected.id)
    }
    if (execution === 'local') {
      tabStore.current.connection_id = null
    }

    tabStore.current.execution = execution
    tabStore.updateTab(tabStore.current)
  }

  const remoteConnected = (type: 'ssh' | 'kubectl', config: { id: number }) => {
    if (!tabStore.current) return
    tabStore.current.execution = type
    tabStore.current[type] = { id: config.id }
    tabStore.current.connection_id = String(config.id)
    tabStore.updateTab(tabStore.current)
  }

  const remoteRemoved = (type: 'ssh' | 'kubectl', id: number) => {
    if (!tabStore.current) return
    const ref = tabStore.current[type]
    const isConnectionId = String(tabStore.current.connection_id) === String(id)
    if ((ref && ref.id === id) || isConnectionId) {
      tabStore.current.execution = 'local'
      tabStore.current[type] = undefined
      tabStore.current.connection_id = null
      tabStore.updateTab(tabStore.current)
    }
  }

  // Connections are atomic to a project: dropdowns list only the project's own
  const dockerSavedConnections = computed(() => dockerStore.connections.filter(c => c.tab_id === tabStore.current?.id))
  const sshSavedConnections = computed(() => sshStore.connections.filter(c => c.tab_id === tabStore.current?.id))
  const kubectlSavedConnections = computed(() =>
    kubectlStore.connections.filter(c => c.tab_id === tabStore.current?.id)
  )

  // Resolve the project's active connection by connection_id (single source of
  // truth) with the legacy inline refs as display fallback
  const activeConnection = computed(() =>
    tabStore.current?.connection_id ? connectionsStore.getConnection(tabStore.current.connection_id) : undefined
  )
  const activeSshName = computed(
    () =>
      (activeConnection.value?.type === 'ssh' ? activeConnection.value.name : undefined) ??
      (tabStore.current?.ssh ? sshStore.getConnection(tabStore.current.ssh.id)?.name : undefined)
  )
  const activeKubectlName = computed(
    () =>
      (activeConnection.value?.type === 'kubectl' ? activeConnection.value.name : undefined) ??
      (tabStore.current?.kubectl ? kubectlStore.getConnection(tabStore.current.kubectl.id)?.name : undefined)
  )
  const activeDockerName = computed(
    () =>
      (activeConnection.value?.type === 'docker' ? activeConnection.value.container_name : undefined) ??
      tabStore.current?.docker?.container_name
  )

  const connectDockerSaved = (id: number) => {
    const connection = dockerStore.getConnection(id)
    if (!connection || !tabStore.current) return
    tabStore.current.connection_id = String(connection.id)
    tabStore.current.execution = 'docker'
    tabStore.updateTab(tabStore.current)
    connect('docker')
  }

  const connectSshSaved = (id: number) => {
    const connection = sshStore.getConnection(id)
    if (!connection || !tabStore.current) return
    tabStore.current.connection_id = String(connection.id)
    tabStore.current.execution = 'ssh'
    tabStore.updateTab(tabStore.current)
    connect('ssh')
  }

  const connectKubectlSaved = (id: number) => {
    const connection = kubectlStore.getConnection(id)
    if (!connection || !tabStore.current) return
    tabStore.current.connection_id = String(connection.id)
    tabStore.current.execution = 'kubectl'
    tabStore.updateTab(tabStore.current)
    connect('kubectl')
  }

  const vaporConfig = computed(() => vaporStore.getConnectionConfig(tabStore?.current?.id))

  const vaporConnected = (environment: string) => {
    if (!tabStore.current) return
    tabStore.current.execution = 'vapor'
    tabStore.current.connection_id = String(tabStore.current.id)
    tabStore.updateTab(tabStore.current)
    if (tab.value?.id) {
      vaporStore.setEnvironment(tabStore.current.id, environment)
    }
  }

  const vaporRemoved = () => {
    if (!tabStore.current) return
    tabStore.current.execution = 'local'
    tabStore.current.connection_id = null
    vaporStore.removeEnvironment(tabStore.current.id)
    tabStore.updateTab(tabStore.current)
  }

  function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  const updateLoader = (name?: string) => {
    if (!tabStore.current) {
      return
    }

    tabStore.current.loader = name || ''
    tabStore.updateTab(tabStore.current)
  }
</script>

<template>
  <div class="flex items-center gap-1" v-if="tab">
    <!-- local -->
    <SecondaryButton
      without-border
      class="!px-2 h-6"
      @click="connect('local')"
      v-tippy="{ content: 'Connect to local', placement: 'bottom' }"
    >
      <ArrowPathIcon v-if="connecting === 'local'" class="size-4 mr-1 animate-spin" />
      <FolderIcon
        v-else
        class="size-4 mr-1"
        :class="{ '!text-green-500': tabStore.getCurrent()?.execution === 'local' }"
      />
      <span class="text-xs">Local</span>
    </SecondaryButton>

    <template v-if="tabStore.getCurrent()?.path !== settingsStore.settings.laravelPath">
      <!-- docker -->
      <DropDown>
        <template v-slot:trigger>
          <SecondaryButton without-border class="!px-2 h-6">
            <ArrowPathIcon v-if="connecting === 'docker'" class="size-4 mr-1 animate-spin" />
            <DockerIcon
              v-else
              class="size-4 mr-1"
              :class="{ '!text-green-500': tabStore.getCurrent()?.execution === 'docker' }"
            />
            <span class="text-xs max-w-[150px] truncate">
              <template v-if="tabStore.getCurrent()?.execution === 'docker' && activeDockerName">
                {{ activeDockerName }}
              </template>
              <template v-else> Docker </template>
            </span>
            <ChevronDownIcon class="size-4 ml-1" />
          </SecondaryButton>
        </template>
        <div>
          <DropDownItem
            v-if="tabStore.getCurrent()?.execution === 'docker' && activeDockerName"
            @click="connect('docker')"
            class="truncate"
          >
            {{ activeDockerName }}
          </DropDownItem>
          <template v-for="conn in dockerSavedConnections" :key="`docker-${conn.id}`">
            <DropDownItem
              v-if="String(conn.id) !== tabStore.getCurrent()?.connection_id"
              @click="connectDockerSaved(conn.id)"
              class="truncate"
            >
              {{ conn.container_name }}
            </DropDownItem>
          </template>
          <DropDownItem @click="dockerModal.openModal()"> Connect </DropDownItem>
        </div>
      </DropDown>

      <!-- vapor -->
      <DropDown>
        <template v-slot:trigger>
          <SecondaryButton without-border class="!px-2 h-6">
            <VaporIcon
              class="size-4 mr-1"
              :class="{ '!text-[#25C4F2]': tabStore.getCurrent()?.execution === 'vapor' }"
            />
            <span class="text-xs max-w-[150px] truncate flex items-center gap-2">
              <span v-if="vaporConfig?.environment">
                {{ capitalize(vaporConfig.environment) }}
              </span>
              <span v-else>Vapor</span>
            </span>
            <ChevronDownIcon class="size-4 ml-1" />
          </SecondaryButton>
        </template>
        <div>
          <template v-for="env in vaporConfig?.environments" :key="env">
            <DropDownItem v-if="vaporConfig?.environment !== env" @click="vaporConnected(env)" class="truncate">
              {{ capitalize(env) }}
            </DropDownItem>
          </template>
          <DropDownItem v-if="vaporConfig?.environments.length == 0">
            <span>No environments found</span>
          </DropDownItem>
          <DropDownItem v-if="vaporConfig?.environment" @click="vaporRemoved()"> Disconnect </DropDownItem>
        </div>
      </DropDown>

      <!-- ssh -->
      <DropDown>
        <template v-slot:trigger>
          <SecondaryButton without-border class="!px-2 h-6">
            <ArrowPathIcon v-if="connecting === 'ssh'" class="size-4 mr-1 animate-spin" />
            <ServerIcon
              v-else
              class="size-4 mr-1"
              :class="[
                tab.execution === 'ssh' && activeConnection?.type === 'ssh' ? `text-${activeConnection.color}-500` : '',
              ]"
            />
            <div class="text-xs max-w-[150px] truncate">
              <div v-if="tab && tab.execution === 'ssh' && activeSshName">{{ activeSshName }}</div>
              <div v-else>SSH</div>
            </div>
            <ChevronDownIcon class="size-4 ml-1" />
          </SecondaryButton>
        </template>
        <div>
          <template v-for="conn in sshSavedConnections" :key="`ssh-conn-${conn.id}`">
            <DropDownItem
              v-if="String(conn.id) !== tabStore.getCurrent()?.connection_id"
              @click="connectSshSaved(conn.id)"
              class="truncate"
            >
              {{ conn.name }}
            </DropDownItem>
          </template>
          <DropDownItem @click="sshModal.openModal()"> Connect </DropDownItem>
        </div>
      </DropDown>

      <!-- kubectl -->
      <DropDown>
        <template v-slot:trigger>
          <SecondaryButton without-border class="!px-2 h-6">
            <ArrowPathIcon v-if="connecting === 'kubectl'" class="size-4 mr-1 animate-spin" />
            <KubectlIcon
              v-else
              class="size-4 mr-1"
              :class="[
                tab.execution === 'kubectl' && activeConnection?.type === 'kubectl'
                  ? `text-${activeConnection.color}-500`
                  : '',
              ]"
            />
            <div class="text-xs max-w-[150px] truncate">
              <div v-if="tab && tab.execution === 'kubectl' && activeKubectlName">{{ activeKubectlName }}</div>
              <div v-else>Kubernetes</div>
            </div>
            <ChevronDownIcon class="size-4 ml-1" />
          </SecondaryButton>
        </template>
        <div>
          <template v-for="conn in kubectlSavedConnections" :key="`kubectl-conn-${conn.id}`">
            <DropDownItem
              v-if="String(conn.id) !== tabStore.getCurrent()?.connection_id"
              @click="connectKubectlSaved(conn.id)"
              class="truncate"
            >
              {{ conn.name }}
            </DropDownItem>
          </template>
          <DropDownItem @click="kubectlModal.openModal()"> Connect </DropDownItem>
        </div>
      </DropDown>
    </template>

    <!-- loader -->
    <DropDown>
      <template v-slot:trigger>
        <SecondaryButton without-border class="!px-2 h-6">
          <BoltIcon class="size-4 mr-1" :class="{ 'text-primary-500': tab.loader }" />
          <div class="text-xs max-w-[150px] truncate">
            <div v-if="tab && tab.loader">
              {{ tab.loader }}
            </div>
            <div v-else>Loader</div>
          </div>
          <ChevronDownIcon class="size-4 ml-1" />
        </SecondaryButton>
      </template>
      <div>
        <DropDownItem key="loader-default" class="truncate" @click="updateLoader()"> Default </DropDownItem>
        <DropDownItem
          v-for="loader in loadersStore.loaders"
          :key="`loader-${loader.name}`"
          class="truncate"
          @click="updateLoader(loader.name)"
        >
          {{ loader.name }}
        </DropDownItem>
        <Divider class="my-1" />
        <DropDownItem @click="router.push({ name: 'settings', params: { tab: 'loaders' } })">
          Manage Loaders
        </DropDownItem>
      </div>
    </DropDown>

    <!-- other tools -->

    <!-- modals -->
    <DockerConnectModal ref="dockerModal" />
    <SSHConnectionsModal
      ref="sshModal"
      @connected="remoteConnected('ssh', $event)"
      @removed="remoteRemoved('ssh', $event)"
    />
    <KubectlConnectionsModal
      ref="kubectlModal"
      @connected="remoteConnected('kubectl', $event)"
      @removed="remoteRemoved('kubectl', $event)"
    />
  </div>
</template>
