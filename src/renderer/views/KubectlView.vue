<script setup lang="ts">
  import PrimaryButton from '../components/PrimaryButton.vue'
  import { EyeIcon, PlusIcon, TrashIcon, WifiIcon, ArrowPathIcon, PencilIcon } from '@heroicons/vue/24/outline'
  import { onBeforeUnmount, onMounted, ref, defineEmits } from 'vue'
  import { useKubectlStore } from '../stores/kubectl'
  import Divider from '../components/Divider.vue'
  import Modal from '../components/Modal.vue'
  import KubectlConnectView from './KubectlConnectView.vue'
  import events from '../events'
  import DropDown from '../components/DropDown.vue'
  import { ConnectionConfig } from '../../types/kubectl.type'
  import DropDownItem from '../components/DropDownItem.vue'

  const kubectlStore = useKubectlStore()
  const kubectlConnectModal = ref()
  const connecting = ref()
  const editId = ref()
  const loadingPods = ref(false)
  const pods = ref([])
  const emit = defineEmits(['connected', 'removed'])

  onMounted(() => {
    events.addEventListener('kubectl.connect.reply', connectReply)
    events.addEventListener('kubectl.pods.reply', podsReply)
    events.addEventListener('dialog.remove.confirmed', removeConfirmed)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('kubectl.connect.reply', connectReply)
    events.removeEventListener('kubectl.pods.reply', podsReply)
    events.removeEventListener('dialog.remove.confirmed', removeConfirmed)
  })

  const add = () => {
    editId.value = null
    kubectlConnectModal.value.openModal()
  }

  const edit = (id: number) => {
    editId.value = id
    kubectlConnectModal.value.openModal()
  }

  const podsReply = (e: any) => {
    loadingPods.value = false
    pods.value = e.detail.pods
  }

  const remove = (id: number) => {
    window.ipcRenderer.send('dialog', {
      buttons: ['No', 'Yes'],
      title: 'Remove Connection',
      message: 'Are you sure you want to remove it?',
      listener: 'dialog.remove.confirmed',
      params: { id },
    })
  }

  const removeConfirmed = (e: any) => {
    if (e.detail.result === 0) {
      return
    }

    kubectlStore.remove(e.detail.params.id)
    emit('removed', e.detail.params.id)
  }

  const getPods = (con: ConnectionConfig) => {
    loadingPods.value = true
    window.ipcRenderer.send('kubectl.pods', {
      context: con.context,
      namespace: con.namespace,
    })
  }

  const connect = (con: ConnectionConfig, pod: string) => {
    connecting.value = con.id
    con.pod = pod
    window.ipcRenderer.send('kubectl.connect', { ...con }, { state: 'connect' })
  }

  const connectReply = (e: any) => {
    if (e.detail.data.state === 'connect') {
      connecting.value = null
      if (e.detail.connected) {
        kubectlStore.updateConnection(e.detail.connection.id, e.detail.connection)
        emit('connected', e.detail.connection)
      }
    }
  }
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
        <template v-for="connection in kubectlStore.connections">
          <div class="grid grid-cols-5 gap-2 items-center">
            <div class="flex items-center">
              <div class="size-4 rounded-full mr-1" :class="[`bg-${connection.color}-500`]"></div>
              {{ connection.name }}
            </div>
            <div>
              <EyeIcon v-tippy="connection.context" class="size-4 hover:text-blue-500" />
            </div>
            <div>
              <EyeIcon v-tippy="connection.namespace" class="size-4 hover:text-blue-500" />
            </div>
            <div>
              <EyeIcon v-tippy="connection.path" class="size-4 hover:text-blue-500" />
            </div>
            <div class="flex gap-1 justify-end space-x-2">
              <button type="button" @click="edit(connection.id)" class="p-1 cursor-pointer">
                <PencilIcon v-tippy="'Edit'" class="size-4 hover:text-blue-500" />
              </button>
              <button type="button" @click="remove(connection.id)" class="p-1 cursor-pointer">
                <TrashIcon v-tippy="'Delete'" class="size-4 hover:text-red-500" />
              </button>
              <button type="button" v-if="connecting === connection.id" class="p-1 cursor-pointer">
                <ArrowPathIcon class="size-4 text-green-500 animate-spin" />
              </button>
              <DropDown align="right" v-else>
                <template #trigger>
                  <button type="button" class="p-1 cursor-pointer" @click="getPods(connection)">
                    <WifiIcon v-tippy="'Connect'" class="size-4 hover:text-green-500 cursor-pointer" />
                  </button>
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
            </div>
          </div>
          <Divider />
        </template>
      </div>
      <div v-if="Object.values(kubectlStore.connections).length === 0" class="grid grid-cols-1 items-center">
        <div>No connections yet!</div>
      </div>
    </div>
    <Modal ref="kubectlConnectModal" :title="editId ? 'Edit Connection' : 'Add Connection'" size="lg">
      <KubectlConnectView @done="kubectlConnectModal.closeModal()" :id="editId" />
    </Modal>
  </div>
</template>

<style scoped></style>
