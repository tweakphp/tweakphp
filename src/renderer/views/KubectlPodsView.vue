<script setup lang="ts">
  import Divider from '../components/Divider.vue'
  import { onBeforeUnmount, onMounted, Ref, ref, defineEmits } from 'vue'
  import { ConnectionConfig } from '../../types/kubectl.type'
  import events from '../events'
  import Modal from '../components/Modal.vue'

  const emit = defineEmits(['connected'])
  const connection: Ref<ConnectionConfig | undefined> = ref()
  const modal = ref()
  const loadingPods = ref(true)
  const pods: Ref<string[]> = ref([])

  onMounted(() => {
    events.addEventListener('kubectl.connect.reply', connectReply)
    events.addEventListener('kubectl.pods.reply', podsReply)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('kubectl.connect.reply', connectReply)
    events.removeEventListener('kubectl.pods.reply', podsReply)
  })

  const connect = (pod: string) => {
    if (connection.value) {
      connection.value.pod = pod
      window.ipcRenderer.send('kubectl.connect', { ...connection }, { state: 'connect' })
    }
  }

  const connectReply = (e: any) => {
    console.log(e)
  }

  const podsReply = (e: any) => {
    loadingPods.value = false
    pods.value = e.detail.pods
  }

  const open = (con: ConnectionConfig) => {
    window.ipcRenderer.send('kubectl.pods', {
      context: con.context,
      namespace: con.namespace,
    })
    connection.value = con
    modal.value.openModal()
  }

  defineExpose({
    open,
  })
</script>

<template>
  <Modal ref="modal" title="Select a Pod" size="2xl">
    <div class="mt-3 w-full mx-auto">
      <div v-if="loadingPods" class="">Loading pods...</div>
      <div v-else class="mx-auto space-y-3">
        <div v-for="pod in pods" :key="`pod-${pod}`" @click="connect(pod)" class="cursor-pointer">
          {{ pod }}
          <Divider />
        </div>
      </div>
    </div>
  </Modal>
</template>
