<script setup lang="ts">
  import Divider from '../components/Divider.vue'
  import TextInput from '../components/TextInput.vue'
  import { onBeforeUnmount, onMounted, Ref, ref, defineEmits, defineProps } from 'vue'
  import PrimaryButton from '../components/PrimaryButton.vue'
  import SelectInput from '../components/SelectInput.vue'
  import { useSSHStore } from '../stores/ssh'
  import { ConnectionConfig } from '../../types/ssh.type'
  import ArrowPathIcon from '../components/icons/ArrowPathIcon.vue'
  import events from '../events'
  import DropDown from '../components/DropDown.vue'
  import DropDownItem from '../components/DropDownItem.vue'
  import { useSettingsStore } from '../stores/settings'

  const platform = window.platformInfo.getPlatform()
  const sshStore = useSSHStore()
  const settingsStore = useSettingsStore()
  const emit = defineEmits(['connected'])
  const props = defineProps({
    id: {
      type: Number,
      required: false,
    },
  })

  const colors = [
    'slate',
    'gray',
    'red',
    'orange',
    'amber',
    'yellow',
    'lime',
    'green',
    'emerald',
    'teal',
    'cyan',
    'sky',
    'blue',
    'indigo',
    'violet',
    'purple',
    'fuchsia',
    'pink',
    'rose',
  ]
  const form: Ref<ConnectionConfig> = ref({
    id: Date.now(),
    name: '',
    color: 'rose',
    host: '',
    port: 22,
    username: '',
    auth_type: 'key',
    password: '',
    privateKey: '',
    path: '',
    php: undefined,
    phar_client: undefined,
  })

  onMounted(() => {
    events.addEventListener('ssh.connect.reply', connectReply)
    if (props.id) {
      const connection = sshStore.getConnection(props.id)
      if (connection) {
        form.value = { ...connection }
      }
    }
  })

  onBeforeUnmount(() => {
    events.removeEventListener('ssh.connect.reply', connectReply)
  })

  const connect = () => {
    sshStore.setConnecting(true)
    if (props.id) {
      window.ipcRenderer.send('ssh.connect', { ...form.value }, { state: 'edit', notify: true })
      return
    }
    window.ipcRenderer.send('ssh.connect', { ...form.value }, { state: 'create', notify: true })
  }

  const connectReply = (e: any) => {
    if (e.detail.data.state === 'create') {
      sshStore.setConnecting(false)
      if (e.detail.connected) {
        sshStore.addConnection(e.detail.config)
        emit('connected')
      }
    }

    if (e.detail.data.state === 'edit') {
      sshStore.setConnecting(false)
      if (e.detail.connected) {
        sshStore.updateConnection(e.detail.config.id, e.detail.config)
        emit('connected')
      }
    }
  }
</script>

<template>
  <div class="mt-3 w-full mx-auto">
    <form class="mx-auto space-y-3">
      <div class="grid grid-cols-2 items-center">
        <div>Name</div>
        <div class="flex items-center justify-between">
          <TextInput class="flex-grow mr-3" id="name" v-model="form.name" placeholder="production-server" />
          <DropDown align="right" class="flex-grow-0">
            <template #trigger>
              <div
                class="!w-full h-7 text-sm border-transparent py-1 px-2 outline focus:!outline-primary-500 rounded-md flex items-center"
                :style="{
                  backgroundColor: settingsStore.colors.backgroundLight,
                  color: settingsStore.colors.foreground,
                  outlineColor: settingsStore.colors.border,
                }"
              >
                <div class="size-4 rounded-full" :class="[`bg-${form.color}-500`]"></div>
              </div>
            </template>
            <div class="space-y-1">
              <DropDownItem
                v-for="color in colors"
                :key="`color-${color}`"
                :color="color"
                @click="form.color = color"
                class="flex items-center"
              >
                <span class="size-4 rounded-full mr-1" :class="[`bg-${color}-500`]"></span>
                <span>{{ color }}</span>
              </DropDownItem>
            </div>
          </DropDown>
        </div>
      </div>
      <Divider />
      <div class="grid grid-cols-2 items-center">
        <div>Host</div>
        <TextInput id="host" v-model="form.host" placeholder="1.2.3.4" />
      </div>
      <Divider />
      <div class="grid grid-cols-2 items-center">
        <div>Port</div>
        <TextInput id="port" v-model="form.port" />
      </div>
      <Divider />
      <div class="grid grid-cols-2 items-center">
        <div>Authentication Type</div>
        <SelectInput id="auth-type" v-model="form.auth_type" placeholder="Authentication Type">
          <option value="key">Private Key (Recommended)</option>
          <option value="password">Password</option>
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
        <TextInput id="password" type="password" v-model="form.password" />
      </div>
      <div v-if="form.auth_type === 'key'" class="grid grid-cols-2 items-center">
        <div>Private Key Path</div>
        <TextInput
          id="key"
          v-model="form.privateKey"
          :placeholder="platform === 'darwin' ? '/Users/username/.ssh/id_rsa' : '/home/username/.ssh/id_rsa'"
        />
      </div>
      <Divider />
      <div class="grid grid-cols-2 items-center">
        <div>Working Directory</div>
        <TextInput id="path" v-model="form.path" placeholder="/var/www" />
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
    </form>
  </div>
</template>

<style scoped></style>
