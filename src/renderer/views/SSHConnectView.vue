<script setup lang="ts">
  import Container from '../components/Container.vue'
  import Title from '../components/Title.vue'
  import Divider from '../components/Divider.vue'
  import TextInput from '../components/TextInput.vue'
  import { onBeforeUnmount, onMounted, Ref, ref } from 'vue'
  import PrimaryButton from '../components/PrimaryButton.vue'
  import SelectInput from '../components/SelectInput.vue'
  import { useSSHStore } from '../stores/ssh'
  import { ConnectionConfig } from '../../types/ssh.type'
  import ArrowPathIcon from '../components/icons/ArrowPathIcon.vue'
  import events from '../events'

  const sshStore = useSSHStore()

  const form: Ref<ConnectionConfig> = ref({
    id: Date.now(),
    host: '65.109.205.85',
    port: 22,
    username: 'vito',
    auth_type: 'key',
    password: '',
    privateKey: '/Users/saeed/.ssh/id_rsa',
    path: '',
  })

  onMounted(() => {
    events.addEventListener('ssh.connect.reply', sshStore.connectReply)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('ssh.connect.reply', sshStore.connectReply)
  })

  const connect = () => {
    sshStore.connect(form.value)
  }
</script>

<template>
  <Container class="pt-[38px]">
    <div class="max-w-2xl mx-auto p-10 space-y-3">
      <div class="flex items-center justify-between">
        <Title>Connect to SSH</Title>
      </div>
      <Divider />
      <div class="grid grid-cols-2 items-center">
        <div>Host</div>
        <TextInput id="host" v-model="form.host" />
      </div>
      <Divider />
      <div class="grid grid-cols-2 items-center">
        <div>Port</div>
        <TextInput id="port" v-model="form.port" />
      </div>
      <Divider />
      <div class="grid grid-cols-2 items-center">
        <div>Authentication Type</div>
        <SelectInput id="auth-type" v-model="form.auth_type" placeholder="Select an authentication type">
          <option value="password">Password</option>
          <option value="key">Private Key</option>
        </SelectInput>
      </div>
      <Divider />
      <div class="grid grid-cols-2 items-center">
        <div>Username</div>
        <TextInput id="username" v-model="form.username" />
      </div>
      <Divider />
      <div v-if="form.auth_type === 'password'" class="grid grid-cols-2 items-center">
        <div>Password</div>
        <TextInput id="password" v-model="form.password" />
      </div>
      <div v-if="form.auth_type === 'key'" class="grid grid-cols-2 items-center">
        <div>Private Key Path</div>
        <TextInput id="key" v-model="form.privateKey" />
      </div>
      <Divider />
      <div class="grid grid-cols-2 items-center">
        <div>App Path</div>
        <TextInput id="path" v-model="form.path" />
      </div>
      <Divider />
      <div class="flex items-center justify-end">
        <PrimaryButton @click="connect" :disabled="sshStore.connecting">
          <ArrowPathIcon
            v-if="sshStore.connecting"
            :spin="true"
            class="w-4 h-4 cursor-pointer hover:text-primary-500 animate-spin mr-1"
          />
          Connect
        </PrimaryButton>
      </div>
    </div>
  </Container>
</template>

<style scoped></style>
