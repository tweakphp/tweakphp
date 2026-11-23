<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../Modal.vue'
  import { ModalSize } from '../../../types/modal.type'
  import NewProjectView from '../NewProjectView.vue'
  import SSHProjectView from '../SSHProjectView.vue'
  import DockerProjectView from '../DockerProjectView.vue'
  import KubectlProjectView from '../KubectlProjectView.vue'
  import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
  import { useSettingsStore } from '../../stores/settings'

  const settingsStore = useSettingsStore()

  const modal = ref<InstanceType<typeof Modal> | null>(null)
  const tab = ref('local')

  const openModal = () => {
    tab.value = 'local'
    modal.value?.openModal()
  }

  const closeModal = () => {
    modal.value?.closeModal()
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <Modal ref="modal" title="Add new project" :size="ModalSize.XL">
    <TabsRoot v-model="tab" default-value="local" activation-mode="manual">
      <TabsList
        class="flex w-full gap-4 border-b"
        :style="{ borderColor: settingsStore.colors.border }"
        aria-label="Project location"
      >
        <TabsTrigger
          v-for="t in [
            { value: 'local', label: 'Local' },
            { value: 'ssh', label: 'SSH' },
            { value: 'docker', label: 'Docker' },
            { value: 'kubectl', label: 'Kubernetes' },
          ]"
          :key="t.value"
          :value="t.value"
          class="flex items-center gap-1.5 pb-2 -mb-px border-b-2 border-transparent text-sm opacity-60 transition data-[state=active]:opacity-100 data-[state=active]:border-primary-500 data-[state=active]:text-primary-500 outline-none focus-visible:text-primary-500"
        >
          {{ t.label }}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="local" class="outline-none">
        <NewProjectView @opened="closeModal()" />
      </TabsContent>
      <TabsContent value="ssh" class="outline-none">
        <SSHProjectView @opened="closeModal()" />
      </TabsContent>
      <TabsContent value="docker" class="outline-none">
        <DockerProjectView @opened="closeModal()" />
      </TabsContent>
      <TabsContent value="kubectl" class="outline-none">
        <KubectlProjectView @opened="closeModal()" />
      </TabsContent>
    </TabsRoot>
  </Modal>
</template>
