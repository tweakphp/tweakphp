<script lang="ts" setup>
  import { ChevronDownIcon, FolderIcon } from '@heroicons/vue/24/outline'
  import SecondaryButton from './SecondaryButton.vue'
  import DockerIcon from './icons/DockerIcon.vue'
  import { useTabsStore } from '../stores/tabs'
  import DropDown from './DropDown.vue'
  import DropDownItem from './DropDownItem.vue'
  import Modal from './Modal.vue'
  import { ref } from 'vue'
  import DockerView from '../views/DockerView.vue'

  const tabStore = useTabsStore()
  const dockerModal = ref()

  const changeExecution = (execution: string) => {
    if (!tabStore.current) {
      return
    }

    tabStore.current.execution = execution

    tabStore.updateTab(tabStore.current)
  }
</script>

<template>
  <div class="flex items-center space-x-2">
    <SecondaryButton class="!px-2" @click="changeExecution('local')">
      <FolderIcon class="size-4 mr-1" :class="{ '!text-green-500': tabStore.current?.execution === 'local' }" />
      <span class="text-xs">Local</span>
    </SecondaryButton>
    <DropDown>
      <template v-slot:trigger>
        <SecondaryButton class="!px-2">
          <DockerIcon class="size-4 mr-1" :class="{ '!text-green-500': tabStore.current?.execution === 'docker' }" />
          <span class="text-xs max-w-[150px] truncate">
            <template v-if="tabStore.current?.execution === 'docker' && tabStore.current?.docker.container_name">
              {{ tabStore.current.docker.container_name }}
            </template>
            <template v-else> Docker </template>
          </span>
          <ChevronDownIcon class="size-4 ml-1" />
        </SecondaryButton>
      </template>
      <div>
        <DropDownItem
          v-if="tabStore.current?.docker.container_name"
          @click="changeExecution('docker')"
          class="truncate"
        >
          {{ tabStore.current?.docker.container_name }}
        </DropDownItem>
        <DropDownItem @click="dockerModal.openModal()"> Connect </DropDownItem>
      </div>
    </DropDown>
    <!-- <SecondaryButton class="!px-2" :class="{ '!bg-primary-600': tabStore.current?.execution === 'ssh' }">
      <ServerIcon class="size-4 mr-1" />
      <span class="text-xs"> SSH </span>
      <ChevronDownIcon class="size-4 ml-2" />
    </SecondaryButton> -->
    <Modal title="Connect to Docker" ref="dockerModal" size="xl">
      <DockerView @connected="dockerModal.closeModal()" />
    </Modal>
  </div>
</template>
