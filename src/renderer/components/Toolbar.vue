<script lang="ts" setup>
  import { ArrowPathIcon, BoltIcon, ChevronDownIcon, FolderIcon, ServerIcon } from '@heroicons/vue/24/outline'
  import SecondaryButton from './SecondaryButton.vue'
  import DockerIcon from './icons/DockerIcon.vue'
  import KubectlIcon from './icons/KubectlIcon.vue'
  import VaporIcon from './icons/VaporIcon.vue'
  import { useTabsStore } from '../stores/tabs'
  import DropDown from './DropDown.vue'
  import DropDownItem from './DropDownItem.vue'
  import Modal from './Modal.vue'
  import { computed, ComputedRef, onBeforeUnmount, onMounted, ref } from 'vue'
  import DockerView from '../views/DockerView.vue'
  import { useSettingsStore } from '../stores/settings'
  import { Tab } from '../../types/tab.type'
  import { useSSHStore } from '../stores/ssh'
  import SSHView from '../views/SSHView.vue'
  import events from '../events'
  import { useKubectlStore } from '../stores/kubectl'
  import KubectlView from '../views/KubectlView.vue'
  import { ConnectReply } from '../../types/client.type'
  import { useLoadersStore } from '../stores/loaders'
  import { useVaporStore } from '../stores/vapor.ts'
  import Divider from './Divider.vue'
  import { useRouter } from 'vue-router'

  const tabStore = useTabsStore()
  const settingsStore = useSettingsStore()
  const sshStore = useSSHStore()
  const kubectlStore = useKubectlStore()
  const loadersStore = useLoadersStore()
  const vaporStore = useVaporStore()
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
    tabStore.current.execution = execution
    tabStore.updateTab(tabStore.current)
  }

  const modals: Record<string, any> = { ssh: sshModal, kubectl: kubectlModal }

  const remoteConnected = (type: 'ssh' | 'kubectl', config: { id: number }) => {
    if (!tabStore.current) return
    tabStore.current.execution = type
    tabStore.current[type] = { id: config.id }
    tabStore.updateTab(tabStore.current)
    modals[type].value.closeModal()
  }

  const remoteRemoved = (type: 'ssh' | 'kubectl', id: number) => {
    if (!tabStore.current) return
    const ref = tabStore.current[type]
    if (ref && ref.id === id) {
      tabStore.current.execution = 'local'
      tabStore.current[type] = undefined
      tabStore.updateTab(tabStore.current)
    }
  }

  const vaporConfig = computed(() => vaporStore.getConnectionConfig(tabStore?.current?.id))

  const vaporConnected = (environment: string) => {
    if (!tabStore.current) return
    tabStore.current.execution = 'vapor'
    tabStore.updateTab(tabStore.current)
    if (tab.value?.id) {
      vaporStore.setEnvironment(tabStore.current.id, environment)
    }
  }

  const vaporRemoved = () => {
    if (!tabStore.current) return
    tabStore.current.execution = 'local'
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
  <div class="flex items-center space-x-2" v-if="tab">
    <!-- local -->
    <SecondaryButton
      class="!px-2"
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
          <SecondaryButton class="!px-2">
            <ArrowPathIcon v-if="connecting === 'docker'" class="size-4 mr-1 animate-spin" />
            <DockerIcon
              v-else
              class="size-4 mr-1"
              :class="{ '!text-green-500': tabStore.getCurrent()?.execution === 'docker' }"
            />
            <span class="text-xs max-w-[150px] truncate">
              <template
                v-if="tabStore.getCurrent()?.execution === 'docker' && tabStore.getCurrent()?.docker?.container_name"
              >
                {{ tabStore.getCurrent()?.docker?.container_name }}
              </template>
              <template v-else> Docker </template>
            </span>
            <ChevronDownIcon class="size-4 ml-1" />
          </SecondaryButton>
        </template>
        <div>
          <DropDownItem
            v-if="tabStore.getCurrent()?.docker?.container_name"
            @click="connect('docker')"
            class="truncate"
          >
            {{ tabStore.getCurrent()?.docker?.container_name }}
          </DropDownItem>
          <DropDownItem @click="dockerModal.openModal()"> Connect </DropDownItem>
        </div>
      </DropDown>

      <!-- vapor -->
      <DropDown>
        <template v-slot:trigger>
          <SecondaryButton class="!px-2">
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
          <SecondaryButton class="!px-2">
            <ArrowPathIcon v-if="connecting === 'ssh'" class="size-4 mr-1 animate-spin" />
            <ServerIcon
              v-else
              class="size-4 mr-1"
              :class="[
                tab.execution === 'ssh' && tab.ssh ? `text-${sshStore.getConnection(tab.ssh.id)?.color}-500` : '',
              ]"
            />
            <div class="text-xs max-w-[150px] truncate">
              <div v-if="tab && tab.execution === 'ssh' && tab.ssh && sshStore.getConnection(tab.ssh.id)">
                {{ sshStore.getConnection(tab.ssh.id)?.name }}
              </div>
              <div
                v-else-if="tab && tab.ssh && sshConnecting && sshStore.getConnection(tab.ssh.id)"
                class="flex items-center"
              >
                {{ sshStore.getConnection(tab.ssh.id)?.name }}
              </div>
              <div v-else>SSH</div>
            </div>
            <ChevronDownIcon class="size-4 ml-1" />
          </SecondaryButton>
        </template>
        <div>
          <DropDownItem
            v-if="tab && tab.ssh && sshStore.getConnection(tab.ssh.id) && tab.execution !== 'ssh'"
            @click="connect('ssh')"
            class="truncate"
          >
            {{ sshStore.getConnection(tab.ssh.id)?.name }}
          </DropDownItem>
          <DropDownItem @click="sshModal.openModal()"> Connect </DropDownItem>
        </div>
      </DropDown>

      <!-- kubectl -->
      <DropDown>
        <template v-slot:trigger>
          <SecondaryButton class="!px-2">
            <ArrowPathIcon v-if="connecting === 'kubectl'" class="size-4 mr-1 animate-spin" />
            <KubectlIcon
              v-else
              class="size-4 mr-1"
              :class="[
                tab.execution === 'kubectl' && tab.kubectl
                  ? `text-${kubectlStore.getConnection(tab.kubectl.id)?.color}-500`
                  : '',
              ]"
            />
            <div class="text-xs max-w-[150px] truncate">
              <div
                v-if="tab && tab.execution === 'kubectl' && tab.kubectl && kubectlStore.getConnection(tab.kubectl.id)"
              >
                {{ kubectlStore.getConnection(tab.kubectl.id)?.name }}
              </div>
              <div
                v-else-if="tab && tab.kubectl && kubectlConnecting && kubectlStore.getConnection(tab.kubectl.id)"
                class="flex items-center"
              >
                {{ kubectlStore.getConnection(tab.kubectl.id)?.name }}
              </div>
              <div v-else>Kubernetes</div>
            </div>
            <ChevronDownIcon class="size-4 ml-1" />
          </SecondaryButton>
        </template>
        <div>
          <DropDownItem
            v-if="tab && tab.kubectl && kubectlStore.getConnection(tab.kubectl.id) && tab.execution !== 'kubectl'"
            @click="connect('kubectl')"
            class="truncate"
          >
            {{ kubectlStore.getConnection(tab.kubectl.id)?.name }}
          </DropDownItem>
          <DropDownItem @click="kubectlModal.openModal()"> Connect </DropDownItem>
        </div>
      </DropDown>
    </template>

    <!-- loader -->
    <DropDown>
      <template v-slot:trigger>
        <SecondaryButton class="!px-2">
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
    <Modal title="Connect to Docker" ref="dockerModal" size="xl">
      <DockerView @connected="dockerModal.closeModal()" />
    </Modal>
    <Modal title="Connect to SSH" ref="sshModal" size="2xl">
      <SSHView @connected="remoteConnected('ssh', $event)" @removed="remoteRemoved('ssh', $event)" />
    </Modal>
    <Modal title="Connect to Kubernetes" ref="kubectlModal" size="2xl">
      <KubectlView @connected="remoteConnected('kubectl', $event)" @removed="remoteRemoved('kubectl', $event)" />
    </Modal>
  </div>
</template>
