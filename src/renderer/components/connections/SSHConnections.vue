<script setup lang="ts">
  import PrimaryButton from '../PrimaryButton.vue'
  import SecondaryButton from '../SecondaryButton.vue'
  import { PlusIcon, WifiIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'
  import AutoScrollText from '../AutoScrollText.vue'
  import { useSSHStore } from '../../stores/ssh'
  import Divider from '../Divider.vue'
  import SSHConnectModal from '../modals/SSHConnectModal.vue'
  import { ConnectionConfig } from '../../../types/ssh.type'
  import { useConnectionView } from '../../composables/useConnectionView'
  import RowActions from '../interactions/RowActions.vue'
  import EmptyState from '../EmptyState.vue'

  const sshStore = useSSHStore()
  const emit = defineEmits(['connected', 'removed'])

  /* @ts-ignore */
  const { connectModal, connecting, editId, add, edit, remove } = useConnectionView({
    store: sshStore,
    connectState: 'connect-ssh',
    emit,
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
</script>

<template>
  <div class="mt-3 w-full mx-auto">
    <div class="mx-auto space-y-3">
      <div class="space-y-3">
        <div class="grid grid-cols-5 gap-2 items-center">
          <div>Name</div>
          <div>Host</div>
          <div>Port</div>
          <div>Path</div>
          <div class="flex justify-end">
            <PrimaryButton @click="add">
              <PlusIcon class="w-4 h-4" />
            </PrimaryButton>
          </div>
        </div>
        <Divider />
        <template v-for="connection in sshStore.connections">
          <div class="grid grid-cols-5 gap-2 items-center">
            <div class="flex items-center">
              <div class="size-4 rounded-full mr-1" :class="[`bg-${connection.color}-500`]"></div>
              {{ connection.name }}
            </div>
            <div>{{ connection.host }}</div>
            <div>{{ connection.port }}</div>
            <div class="min-w-0">
              <AutoScrollText>{{ connection.path }}</AutoScrollText>
            </div>
            <RowActions @edit="edit(connection.id)" @remove="remove(connection.id)">
              <SecondaryButton v-if="connecting === connection.id" class="!p-1 !border-transparent">
                <ArrowPathIcon class="size-4 text-green-500 animate-spin" />
              </SecondaryButton>
              <SecondaryButton v-else class="!p-1 !border-transparent" v-tippy="'Connect'" @click="connect(connection)">
                <WifiIcon class="size-4 hover:text-green-500" />
              </SecondaryButton>
            </RowActions>
          </div>
          <Divider />
        </template>
      </div>
      <EmptyState
        v-if="Object.values(sshStore.connections).length === 0"
        message="No connections yet, click the + button to add one."
      />
    </div>
    <SSHConnectModal ref="connectModal" :id="editId" />
  </div>
</template>

<style scoped></style>
