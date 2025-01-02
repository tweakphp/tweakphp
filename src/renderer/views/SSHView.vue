<script setup lang="ts">
  import Container from '../components/Container.vue'
  import Title from '../components/Title.vue'
  import PrimaryButton from '../components/PrimaryButton.vue'
  import { PlusIcon } from '@heroicons/vue/24/outline'
  import { onMounted, onBeforeUnmount } from 'vue'
  import { useSSHStore } from '../stores/ssh'
  import Divider from '../components/Divider.vue'
  import events from '../events'

  const sshStore = useSSHStore()

  onMounted(() => {
    events.addEventListener('ssh.connect.reply', sshStore.connectReply)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('ssh.connect.reply', sshStore.connectReply)
  })
</script>

<template>
  <Container class="pt-[38px]">
    <div class="max-w-2xl mx-auto space-y-3 p-10">
      <div class="flex items-center justify-between">
        <Title>SSH Connections</Title>
        <PrimaryButton @click="$router.push('/ssh/connect')">
          <PlusIcon class="w-4 h-4" />
        </PrimaryButton>
      </div>
      <Divider />
      <div v-if="Object.values(sshStore.connections).length > 0" class="space-y-3">
        <template v-for="connection in sshStore.connections">
          <div class="grid grid-cols-3 items-center">
            <div>{{ connection.host }}</div>
            <div>{{ connection.port }}</div>
            <div>-</div>
          </div>
          <Divider />
        </template>
      </div>
      <div class="grid grid-cols-1 items-center">
        <div>No connections yet!</div>
      </div>
    </div>
  </Container>
</template>

<style scoped></style>
