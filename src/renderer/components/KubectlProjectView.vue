<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref } from 'vue'
  import { ArrowPathIcon } from '@heroicons/vue/24/outline'
  import { useKubectlStore } from '../stores/kubectl'
  import { useTabsStore } from '../stores/tabs'
  import { useConnectionView } from '../composables/useConnectionView'
  import PrimaryButton from './PrimaryButton.vue'
  import SecondaryButton from './SecondaryButton.vue'
  import Divider from './Divider.vue'
  import EmptyState from './EmptyState.vue'
  import AutoScrollText from './AutoScrollText.vue'
  import RowActions from './interactions/RowActions.vue'
  import DropDown from './DropDown.vue'
  import DropDownItem from './DropDownItem.vue'
  import KubectlConnectModal from './modals/KubectlConnectModal.vue'
  import events from '../events'
  import router from '../router'
  import { ActionReply } from '../../types/client.type'
  import { ConnectionConfig } from '../../types/kubectl.type'

  const kubectlStore = useKubectlStore()
  const tabsStore = useTabsStore()

  const emit = defineEmits(['opened'])

  const loadingPods = ref(false)
  const pods = ref<string[]>([])

  const { connectModal, connecting, editId, add, edit, remove } = useConnectionView({
    store: kubectlStore,
    connectState: 'connect',
    emit: (event: string, ...args: any[]) => {
      if (event === 'connected') {
        openRemoteProject(args[0] as ConnectionConfig)
      }
      // removed: remote-only tabs bound to a removed connection are left
      // open, the user can link another connection from the toolbar
    },
    onConnectReply: reply => {
      kubectlStore.updateConnection(reply.connection.id, reply.connection)
    },
  })

  const getPods = (connection: ConnectionConfig) => {
    loadingPods.value = true
    window.ipcRenderer.send('client.action', {
      type: 'getPods',
      connection: { ...connection },
    })
  }

  const connect = (connection: ConnectionConfig, pod: string) => {
    connecting.value = connection.id
    connection.pod = pod
    window.ipcRenderer.send('client.connect', {
      connection: { ...connection },
      data: {
        state: 'connect',
        setup: true,
      },
    })
  }

  const openRemoteProject = (connection: ConnectionConfig) => {
    const tab = tabsStore.addTab({
      type: 'code',
      name: connection.name,
      execution: 'kubectl',
      kubectl: { id: connection.id },
    })
    router.push({ name: 'code', params: { id: tab.id } })
    emit('opened')
  }

  const actionReply = (e: any) => {
    const reply = e.detail as ActionReply
    if (reply.type !== 'getPods') {
      return
    }
    loadingPods.value = false
    if (reply.error) {
      alert(reply.error)
      return
    }
    pods.value = reply.result
  }

  onMounted(() => {
    events.addEventListener('client.action.reply', actionReply)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('client.action.reply', actionReply)
  })
</script>

<template>
  <div class="mt-3 w-full mx-auto">
    <div class="flex items-center justify-end">
      <SecondaryButton @click="add"> Add connection </SecondaryButton>
    </div>
    <Divider class="mt-3" />
    <div class="space-y-3 mt-3">
      <div
        class="flex items-center justify-between"
        v-for="connection in kubectlStore.connections"
        :key="connection.id"
      >
        <div class="w-full flex items-start">
          <span class="size-4 rounded-full mt-[1px] shrink-0" :class="[`bg-${connection.color}-500`]"></span>
          <div class="flex flex-col ml-2 items-start">
            <p class="text-xs capitalize">{{ connection.name }}</p>
            <p class="text-[10px] opacity-40 mt-[1px] truncate w-[300px] text-left">
              {{ connection.context }}
              <AutoScrollText v-if="connection.namespace"> · {{ connection.namespace }} </AutoScrollText>
            </p>
          </div>
        </div>
        <RowActions @edit="edit(connection.id)" @remove="remove(connection.id)">
          <ArrowPathIcon v-if="connecting === connection.id" class="w-4 h-4 text-green-500 animate-spin" />
          <DropDown v-else align="right">
            <template #trigger>
              <PrimaryButton :disabled="loadingPods" v-tippy="'Select a pod to connect'" @click="getPods(connection)">
                {{ loadingPods ? 'Loading…' : 'Connect' }}
              </PrimaryButton>
            </template>
            <div class="p-1">
              <DropDownItem v-if="loadingPods">Loading pods…</DropDownItem>
              <div v-else class="space-y-1">
                <DropDownItem
                  v-for="pod in pods"
                  :key="`pod-${pod}`"
                  @click="connect(connection, pod)"
                  class="cursor-pointer"
                >
                  {{ pod }}
                </DropDownItem>
              </div>
            </div>
          </DropDown>
        </RowActions>
      </div>
      <div v-if="Object.values(kubectlStore.connections).length === 0">
        <EmptyState message="No connections yet, click the Add connection button to add one." />
      </div>
    </div>
  </div>
  <KubectlConnectModal ref="connectModal" :id="editId" />
</template>

<style scoped></style>
