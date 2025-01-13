<script setup lang="ts">
  import { useSSHStore } from '../stores/ssh'

  import Container from '@/components/Container.vue'
  import SelectInput from '@/components/SelectInput.vue'
  import { onMounted, ref } from 'vue'
  import Divider from '@/components/Divider.vue'
  import DockerSSHConnectView from '@/views/DockerSSHConnectView.vue'
  import { useTabsStore } from '../stores/tabs.ts'
  import { Tab } from '../types/tab.type.ts'

  const sshStore = useSSHStore()
  const tabsStore = useTabsStore()

  const connecting = ref()
  const form = ref({
    connection_id: 0,
    container_id: '',
    container_name: '',
    working_directory: '/var/www/html',
  })

  const selectConnection = () => {
    const connection = sshStore.getConnection(form.value.connection_id)
    connecting.value = form.value.connection_id

    window.ipcRenderer.send('ssh.connect', { ...connection }, { state: 'connect' })
  }

  onMounted(() => {
    let currentTab: Tab | null = tabsStore.getCurrent()
    if (currentTab === null) {
      return
    }

    form.value.connection_id = currentTab.docker_ssh?.ssh_id
  })
</script>

<template>
  <Container>
    <div class="mt-3 w-full mx-auto">
      <div class="mx-auto space-y-3">
        <div class="grid grid-cols-2 items-center">
          <div>SSH Connection</div>

          <div class="flex gap-3 items-center">
            <div class="w-full">
              <SelectInput
                v-if="sshStore.connections.length > 0"
                placeholder="Select connection"
                id="docker-ssh-containers"
                v-model="form.connection_id"
                @change="selectConnection"
              >
                <option v-for="connection in sshStore.connections" :key="connection.id" :value="connection.id">
                  {{ connection.name }} - {{ connection.path }}
                </option>
              </SelectInput>
            </div>
          </div>
        </div>

        <Divider />

        <DockerSSHConnectView v-if="form.connection_id" :ssh-id="form.connection_id" />
      </div>
    </div>
  </Container>
</template>

<style scoped></style>
