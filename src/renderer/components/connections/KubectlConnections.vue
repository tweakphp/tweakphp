<script setup lang="ts">
  import PrimaryButton from '../PrimaryButton.vue'
  import SecondaryButton from '../SecondaryButton.vue'
  import { PlusIcon, WifiIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'
  import AutoScrollText from '../AutoScrollText.vue'
  import { onBeforeUnmount, onMounted, ref } from 'vue'
  import { useKubectlStore } from '../../stores/kubectl'
  import Divider from '../Divider.vue'
  import KubectlConnectModal from '../modals/KubectlConnectModal.vue'
  import events from '../../events'
  import DropDown from '../DropDown.vue'
  import { ConnectionConfig } from '../../../types/kubectl.type'
  import DropDownItem from '../DropDownItem.vue'
  import { ActionReply } from '../../../types/client.type'
  import { useConnectionView } from '../../composables/useConnectionView'
  import RowActions from '../interactions/RowActions.vue'
  import EmptyState from '../EmptyState.vue'
  import { computed } from 'vue'
  import { useTabsStore } from '../../stores/tabs'

  const kubectlStore = useKubectlStore()
  const tabsStore = useTabsStore()
  const loadingPods = ref(false)
  const pods = ref([])
  const emit = defineEmits(['connected', 'removed'])

  // Connections are atomic to a project: only list the current project's own
  const projectConnections = computed(() =>
    kubectlStore.connections.filter(connection => connection.tab_id === tabsStore.current?.id)
  )

  /* @ts-ignore */
  const { connectModal, connecting, editId, add, edit, remove } = useConnectionView({
    store: kubectlStore,
    connectState: 'connect',
    emit,
    onConnectReply: reply => {
      kubectlStore.updateConnection(reply.connection.id, reply.connection)
    },
  })

  const getPods = (con: ConnectionConfig) => {
    loadingPods.value = true
    window.ipcRenderer.send('client.action', {
      type: 'getPods',
      connection: { ...con },
    })
  }

  const connect = (con: ConnectionConfig, pod: string) => {
    connecting.value = con.id
    con.pod = pod
    window.ipcRenderer.send('client.connect', {
      connection: { ...con },
      data: {
        state: 'connect',
        setup: true,
      },
    })
  }

  const actionReply = (e: any) => {
    const reply = e.detail as ActionReply
    if (reply.error) {
      alert(reply.error)
      return
    }

    if (reply.type === 'getPods') {
      loadingPods.value = false
      pods.value = reply.result
    }
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
    <div class="mx-auto space-y-3">
      <div class="space-y-3">
        <div class="grid grid-cols-5 gap-2 items-center">
          <div>Name</div>
          <div>Context</div>
          <div>Namespace</div>
          <div>Path</div>
          <div class="flex justify-end">
            <PrimaryButton @click="add">
              <PlusIcon class="w-4 h-4" />
            </PrimaryButton>
          </div>
        </div>
        <Divider />
        <template v-for="connection in projectConnections">
          <div class="grid grid-cols-5 gap-2 items-center">
            <div class="flex items-center">
              <div class="size-4 rounded-full mr-1" :class="[`bg-${connection.color}-500`]"></div>
              {{ connection.name }}
            </div>
            <div class="min-w-0">
              <AutoScrollText>{{ connection.context }}</AutoScrollText>
            </div>
            <div class="min-w-0">
              <AutoScrollText>{{ connection.namespace }}</AutoScrollText>
            </div>
            <div class="min-w-0">
              <AutoScrollText>{{ connection.path }}</AutoScrollText>
            </div>
            <RowActions @edit="edit(connection.id)" @remove="remove(connection.id)">
              <SecondaryButton v-if="connecting === connection.id" class="!p-1 !border-transparent">
                <ArrowPathIcon class="size-4 text-green-500 animate-spin" />
              </SecondaryButton>
              <DropDown align="right" v-else>
                <template #trigger>
                  <SecondaryButton class="!p-1 !border-transparent" v-tippy="'Connect'" @click="getPods(connection)">
                    <WifiIcon class="size-4 hover:text-green-500" />
                  </SecondaryButton>
                </template>
                <div class="p-1">
                  <DropDownItem v-if="loadingPods">Loading Pods...</DropDownItem>
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
          <Divider />
        </template>
      </div>
      <EmptyState v-if="projectConnections.length === 0" message="No connections yet, click the + button to add one." />
    </div>
    <KubectlConnectModal ref="connectModal" :id="editId" />
  </div>
</template>

<style scoped></style>
