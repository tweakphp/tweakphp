<script setup lang="ts">
  import TextInput from '../TextInput.vue'
  import { onBeforeUnmount, onMounted, Ref, ref } from 'vue'
  import SelectInput from '../SelectInput.vue'
  import { ConnectionConfig } from '../../../types/kubectl.type'
  import events from '../../events'
  import { useKubectlStore } from '../../stores/kubectl'
  import { ActionReply } from '../../../types/client.type'
  import FormField from './FormField.vue'
  import ColorPickerInput from '../interactions/ColorPickerInput.vue'

  const kubectlStore = useKubectlStore()
  const emit = defineEmits(['done'])
  const props = defineProps({
    id: {
      type: Number,
      required: false,
    },
  })
  const contexts = ref<string[]>([])
  const namespaces = ref<string[]>([])

  const form: Ref<ConnectionConfig> = ref({
    type: 'kubectl',
    id: Date.now(),
    name: '',
    color: 'rose',
    context: '',
    namespace: '',
    pod: '',
    path: '',
    php: undefined,
    client_path: undefined,
  })

  onMounted(() => {
    events.addEventListener('client.action.reply', actionReply)
    getContexts()
    if (props.id) {
      const connection = kubectlStore.getConnection(props.id)
      if (connection) {
        form.value = { ...connection }
        getNamespaces()
      }
    }
  })

  const getContexts = () => {
    window.ipcRenderer.send('client.action', {
      type: 'getContexts',
      connection: { ...form.value },
    })
  }

  const getNamespaces = () => {
    window.ipcRenderer.send('client.action', {
      type: 'getNamespaces',
      connection: { ...form.value },
    })
  }

  const save = () => {
    if (props.id) {
      kubectlStore.updateConnection(props.id, form.value)
      emit('done')
      return
    }
    kubectlStore.addConnection(form.value)
    emit('done')
  }

  defineExpose({ save })

  const actionReply = (e: any) => {
    const reply = e.detail as ActionReply
    if (reply.error) {
      alert(reply.error)
      return
    }

    if (reply.type === 'getContexts') {
      contexts.value = reply.result
    }

    if (reply.type === 'getNamespaces') {
      namespaces.value = reply.result
    }
  }

  onBeforeUnmount(() => {
    events.removeEventListener('client.action.reply', actionReply)
  })
</script>

<template>
  <div class="mt-3 w-full mx-auto">
    <form class="mx-auto space-y-3">
      <FormField label="Name">
        <div class="flex gap-3 items-center justify-between">
          <TextInput class="w-full" id="name" v-model="form.name" placeholder="production-server" />
          <ColorPickerInput v-model="form.color" />
        </div>
      </FormField>
      <FormField label="Context" divider>
        <SelectInput id="context" v-model="form.context" placeholder="Select context" @change="getNamespaces()">
          <option v-for="context in contexts" :value="context" :key="`context-${context}`">{{ context }}</option>
        </SelectInput>
      </FormField>
      <FormField label="Namespace" divider>
        <SelectInput id="namespace" v-model="form.namespace" placeholder="Select namespace">
          <option v-for="namespace in namespaces" :value="namespace" :key="`namespace-${namespace}`">
            {{ namespace }}
          </option>
        </SelectInput>
      </FormField>
      <FormField label="Working Directory" divider>
        <TextInput class="w-full" id="path" v-model="form.path" placeholder="/var/www" />
      </FormField>
    </form>
  </div>
</template>

<style scoped></style>
