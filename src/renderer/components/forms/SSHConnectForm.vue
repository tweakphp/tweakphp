<script setup lang="ts">
  import TextInput from '../TextInput.vue'
  import { computed, onBeforeUnmount, onMounted, Ref, ref } from 'vue'
  import SelectInput from '../SelectInput.vue'
  import { useSSHStore } from '../../stores/ssh'
  import { ConnectionConfig } from '../../../types/ssh.type'
  import events from '../../events'
  import { ConnectReply } from '../../../types/client.type'
  import FormField from './FormField.vue'
  import ColorPickerInput from '../interactions/ColorPickerInput.vue'

  const platform = window.platformInfo.getPlatform()
  const sshStore = useSSHStore()
  const emit = defineEmits(['connected'])
  const props = defineProps({
    id: {
      type: Number,
      required: false,
    },
  })

  const form: Ref<ConnectionConfig> = ref({
    type: 'ssh',
    id: Date.now(),
    name: '',
    color: 'rose',
    host: '',
    port: 22,
    username: '',
    auth_type: 'key',
    password: '',
    privateKey: '',
    passphrase: '',
    path: '',
    php: undefined,
    client_path: undefined,
  })

  onMounted(() => {
    events.addEventListener('client.connect.reply', connectReply)
    if (props.id) {
      const connection = sshStore.getConnection(props.id)
      if (connection) {
        form.value = { ...connection }
      }
    }
  })

  onBeforeUnmount(() => {
    events.removeEventListener('client.connect.reply', connectReply)
    sshStore.setConnecting(false)
  })

  const connect = () => {
    sshStore.setConnecting(true)
    window.ipcRenderer.send('client.connect', {
      connection: { ...form.value },
      data: {
        state: props.id ? 'edit-ssh' : 'create-ssh',
        setup: true,
      },
    })
  }

  const connectReply = (e: any) => {
    const reply = e.detail as ConnectReply
    if (reply.data?.state === 'create-ssh') {
      sshStore.setConnecting(false)
      if (reply.connected) {
        sshStore.addConnection(reply.connection)
        emit('connected')
      }
    }

    if (reply.data?.state === 'edit-ssh') {
      sshStore.setConnecting(false)
      if (reply.connected) {
        sshStore.updateConnection(reply.connection.id, reply.connection)
        emit('connected')
      }
    }
  }

  const connecting = computed(() => sshStore.connecting)

  defineExpose({ connect, connecting })
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
      <FormField label="Host" divider>
        <TextInput class="w-full" id="host" v-model="form.host" placeholder="1.2.3.4" />
      </FormField>
      <FormField label="Port" divider>
        <TextInput class="w-full" id="port" v-model="form.port" />
      </FormField>
      <FormField label="Authentication Type" divider>
        <SelectInput id="auth-type" v-model="form.auth_type" placeholder="Authentication Type">
          <option value="key">Private Key (Recommended)</option>
          <option value="password">Password</option>
        </SelectInput>
      </FormField>
      <FormField label="Username" divider>
        <TextInput class="w-full" id="username" v-model="form.username" />
      </FormField>
      <FormField v-if="form.auth_type === 'password'" label="Password" divider>
        <TextInput class="w-full" id="password" type="password" v-model="form.password" />
      </FormField>
      <FormField v-if="form.auth_type === 'key'" label="Passphrase" divider>
        <TextInput class="w-full" id="passphrase" type="password" v-model="form.passphrase" />
      </FormField>
      <FormField v-if="form.auth_type === 'key'" label="Private Key Path" divider>
        <TextInput
          class="w-full"
          id="key"
          v-model="form.privateKey"
          :placeholder="platform === 'darwin' ? '/Users/username/.ssh/id_rsa' : '/home/username/.ssh/id_rsa'"
        />
      </FormField>
      <FormField label="Working Directory" divider>
        <TextInput class="w-full" id="path" v-model="form.path" placeholder="/var/www" />
      </FormField>
    </form>
  </div>
</template>

<style scoped></style>
