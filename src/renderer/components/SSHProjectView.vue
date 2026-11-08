<script setup lang="ts">
  import { onBeforeUnmount, onMounted } from 'vue'
  import { ArrowPathIcon } from '@heroicons/vue/24/outline'
  import { useSSHStore } from '../stores/ssh'
  import { useTabsStore } from '../stores/tabs'
  import { useConnectionView } from '../composables/useConnectionView'
  import PrimaryButton from './PrimaryButton.vue'
  import SecondaryButton from './SecondaryButton.vue'
  import Divider from './Divider.vue'
  import EmptyState from './EmptyState.vue'
  import AutoScrollText from './AutoScrollText.vue'
  import RowActions from './interactions/RowActions.vue'
  import SSHConnectModal from './modals/SSHConnectModal.vue'
  import events from '../events'
  import router from '../router'
  import { ConnectReply } from '../../types/client.type'
  import { ConnectionConfig } from '../../types/ssh.type'

  const sshStore = useSSHStore()
  const tabsStore = useTabsStore()

  const emit = defineEmits(['opened'])

  const { connectModal, connecting, editId, add, edit, remove } = useConnectionView({
    store: sshStore,
    connectState: 'connect-ssh',
    emit: (event: string, ...args: any[]) => {
      if (event === 'connected') {
        openRemoteProject(args[0] as ConnectionConfig)
      }
      // removed: remote-only tabs bound to a removed connection are left
      // open, the user can link another connection from the toolbar
    },
  })

  const connect = (connection: ConnectionConfig) => {
    connecting.value = connection.id
    window.ipcRenderer.send('client.connect', {
      connection: { ...connection },
      data: {
        state: 'connect-ssh',
        setup: true,
      },
    })
  }

  const openRemoteProject = (connection: ConnectionConfig) => {
    const tab = tabsStore.addTab({
      type: 'code',
      name: connection.name,
      execution: 'ssh',
      ssh: { id: connection.id },
    })
    router.push({ name: 'code', params: { id: tab.id } })
    emit('opened')
  }

  // When a new connection is created from the nested "Add connection" modal,
  // connect to it right away so the project opens with a single action.
  const createReplyListener = (e: any) => {
    const reply = e.detail as ConnectReply
    if (reply.data?.state !== 'create-ssh' || !reply.connected) {
      return
    }
    connect(reply.connection as ConnectionConfig)
  }

  onMounted(() => {
    events.addEventListener('client.connect.reply', createReplyListener)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('client.connect.reply', createReplyListener)
  })
</script>

<template>
  <div class="mt-3 w-full mx-auto">
    <div class="flex items-center justify-end">
      <SecondaryButton @click="add"> Add connection </SecondaryButton>
    </div>
    <Divider class="mt-3" />
    <div class="space-y-3 mt-3">
      <div class="flex items-center justify-between" v-for="connection in sshStore.connections" :key="connection.id">
        <button type="button" class="w-full flex items-start" @click="connect(connection)">
          <span class="size-4 rounded-full mt-[1px] shrink-0" :class="[`bg-${connection.color}-500`]"></span>
          <div class="flex flex-col ml-2 items-start">
            <p class="text-xs capitalize">{{ connection.name }}</p>
            <p class="text-[10px] opacity-40 mt-[1px] truncate w-[300px] text-left">
              {{ connection.username }}@{{ connection.host }}:{{ connection.port }}
              <AutoScrollText v-if="connection.path"> · {{ connection.path }} </AutoScrollText>
            </p>
          </div>
        </button>
        <RowActions @edit="edit(connection.id)" @remove="remove(connection.id)">
          <PrimaryButton :disabled="connecting === connection.id" @click="connect(connection)">
            <ArrowPathIcon v-if="connecting === connection.id" class="w-4 h-4 animate-spin mr-1" />
            Connect
          </PrimaryButton>
        </RowActions>
      </div>
      <div v-if="Object.values(sshStore.connections).length === 0">
        <EmptyState message="No connections yet, click the Add connection button to add one." />
      </div>
    </div>
  </div>
  <SSHConnectModal ref="connectModal" :id="editId" />
</template>

<style scoped></style>
