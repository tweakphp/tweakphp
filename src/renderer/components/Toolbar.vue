<script lang="ts" setup>
  import { ArrowPathIcon, ChevronDownIcon, FolderIcon, ServerIcon, XMarkIcon } from '@heroicons/vue/24/outline'
  import SecondaryButton from './SecondaryButton.vue'
  import DockerIcon from './icons/DockerIcon.vue'
  import { useTabsStore } from '../stores/tabs'
  import DropDown from './DropDown.vue'
  import DropDownItem from './DropDownItem.vue'
  import Modal from './Modal.vue'
  import { computed, ComputedRef, onBeforeUnmount, onMounted, ref } from 'vue'
  import DockerView from '../views/DockerView.vue'
  import { useSettingsStore } from '../stores/settings'
  import { Tab } from '../types/tab.type'
  import { useSSHStore } from '../stores/ssh'
  import SSHView from '../views/SSHView.vue'
  import { ConnectionConfig } from '../../types/ssh.type'

  const tabStore = useTabsStore()
  const settingsStore = useSettingsStore()
  const sshStore = useSSHStore()
  const dockerModal = ref()
  const sshModal = ref()
  const tab: ComputedRef<Tab | null> = computed(() => tabStore.getCurrent())
  const sshConnecting = ref(false)
  import events from '../events'

  onMounted(() => {
    events.addEventListener('ssh.connect.reply', sshConnectReply)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('ssh.connect.reply', sshConnectReply)
  })

  const changeExecution = (execution: string) => {
    if (!tabStore.current) {
      return
    }

    tabStore.current.execution = execution

    tabStore.updateTab(tabStore.current)
  }

  const sshConnect = (config: ConnectionConfig | undefined) => {
    sshConnecting.value = true
    window.ipcRenderer.send('ssh.connect', { ...config }, { state: 'reconnect' })
  }

  const sshConnectReply = (e: any) => {
    if (e.detail.data.state === 'reconnect') {
      sshConnecting.value = false
      if (e.detail.connected) {
        sshConnected(e.detail.config)
      }
    }
  }

  const sshConnected = (config: ConnectionConfig) => {
    if (!tabStore.current) {
      return
    }

    tabStore.current.execution = 'ssh'
    tabStore.current.ssh = { id: config.id }

    tabStore.updateTab(tabStore.current)
    sshModal.value.closeModal()
  }

  const sshRemoved = (id: number) => {
    if (!tabStore.current) {
      return
    }

    if (tabStore.current.ssh && tabStore.current.ssh.id === id) {
      tabStore.current.execution = 'local'
      tabStore.current.ssh = undefined
      tabStore.updateTab(tabStore.current)
    }
  }
</script>

<template>
  <div class="flex items-center space-x-2" v-if="tab">
    <SecondaryButton
      class="!px-2"
      @click="changeExecution('local')"
      v-tippy="{ content: 'Connect to local', placement: 'bottom' }"
    >
      <FolderIcon class="size-4 mr-1" :class="{ '!text-green-500': tabStore.getCurrent()?.execution === 'local' }" />
      <span class="text-xs">Local</span>
    </SecondaryButton>
    <template v-if="tabStore.getCurrent().path !== settingsStore.settings.laravelPath">
      <DropDown>
        <template v-slot:trigger>
          <SecondaryButton class="!px-2">
            <DockerIcon
              class="size-4 mr-1"
              :class="{ '!text-green-500': tabStore.getCurrent()?.execution === 'docker' }"
            />
            <span class="text-xs max-w-[150px] truncate">
              <template
                v-if="tabStore.getCurrent().execution === 'docker' && tabStore.getCurrent()?.docker.container_name"
              >
                {{ tabStore.getCurrent()?.docker.container_name }}
              </template>
              <template v-else> Docker </template>
            </span>
            <ChevronDownIcon class="size-4 ml-1" />
          </SecondaryButton>
        </template>
        <div>
          <DropDownItem
            v-if="tabStore.getCurrent()?.docker.container_name"
            @click="changeExecution('docker')"
            class="truncate"
          >
            {{ tabStore.getCurrent()?.docker.container_name }}
          </DropDownItem>
          <DropDownItem @click="dockerModal.openModal()"> Connect </DropDownItem>
        </div>
      </DropDown>
      <DropDown>
        <template v-slot:trigger>
          <SecondaryButton class="!px-2">
            <ArrowPathIcon
              v-if="tab && tab.ssh && sshConnecting && sshStore.getConnection(tab.ssh.id)"
              class="size-4 mr-1 animate-spin"
            />
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
            @click="sshConnect(sshStore.getConnection(tab.ssh.id))"
            class="truncate"
          >
            {{ sshStore.getConnection(tab.ssh.id)?.name }}
          </DropDownItem>
          <DropDownItem @click="sshModal.openModal()"> Connect </DropDownItem>
        </div>
      </DropDown>
    </template>
    <SecondaryButton
      class="!px-2"
      v-tippy="{ content: 'Close', placement: 'right' }"
      @click="tabStore.removeTab(tab.id)"
    >
      <XMarkIcon class="size-4" />
    </SecondaryButton>
    <Modal title="Connect to Docker" ref="dockerModal" size="xl">
      <DockerView @connected="dockerModal.closeModal()" />
    </Modal>
    <Modal title="Connect to SSH" ref="sshModal" size="2xl">
      <SSHView @connected="sshConnected($event)" @removed="sshRemoved($event)" />
    </Modal>
  </div>
</template>
