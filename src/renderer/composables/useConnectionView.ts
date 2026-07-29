import { onBeforeUnmount, onMounted, ref } from 'vue'
import events from '../events'
import { ConnectReply } from '../../types/client.type'

export function useConnectionView(options: {
  store: { remove: (id: number) => void }
  connectState: string
  emit: (event: 'connected' | 'removed', ...args: any[]) => void
  onConnectReply?: (reply: ConnectReply) => void
}) {
  const connectModal = ref()
  const connecting = ref()
  const editId = ref()

  const add = () => {
    editId.value = null
    connectModal.value.openModal()
  }

  const edit = (id: number) => {
    editId.value = id
    connectModal.value.openModal()
  }

  const remove = (id: number) => {
    if (confirm('Are you sure you want to remove it?')) {
      options.store.remove(id)
      options.emit('removed', id)
    }
  }

  const connectReply = (e: any) => {
    const reply = e.detail as ConnectReply
    if (reply.data?.state === options.connectState) {
      connecting.value = null
      if (reply.connected) {
        if (options.onConnectReply) {
          options.onConnectReply(reply)
        }
        options.emit('connected', reply.connection)
      }
    }
  }

  onMounted(() => {
    events.addEventListener('client.connect.reply', connectReply)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('client.connect.reply', connectReply)
  })

  return { connectModal, connecting, editId, add, edit, remove }
}
