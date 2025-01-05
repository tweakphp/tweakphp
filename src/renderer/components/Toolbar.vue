<script lang="ts" setup>
  import { ChevronDownIcon, FolderIcon, XMarkIcon } from '@heroicons/vue/24/outline'
  import SecondaryButton from './SecondaryButton.vue'
  import DockerIcon from './icons/DockerIcon.vue'
  import { useTabsStore } from '../stores/tabs'
  import DropDown from './DropDown.vue'
  import DropDownItem from './DropDownItem.vue'
  import Modal from './Modal.vue'
  import { computed, ComputedRef, ref } from 'vue'
  import DockerView from '../views/DockerView.vue'
  import { useSettingsStore } from '../stores/settings'
  import { Tab } from '../types/tab.type'

  const tabStore = useTabsStore()
  const settingsStore = useSettingsStore()
  const dockerModal = ref()
  const tab: ComputedRef<Tab | null> = computed(() => tabStore.getCurrent())

  const changeExecution = (execution: string) => {
    if (!tabStore.current) {
      return
    }

    tabStore.current.execution = execution

    tabStore.updateTab(tabStore.current)
  }
</script>

<template>
  <div class="flex items-center space-x-2" v-if="tab">
    <SecondaryButton
      class="!px-2"
      @click="changeExecution('local')"
      v-tippy="{ content: 'Connect to local', placement: 'bottom' }"
    >
      <FolderIcon class="size-4 mr-1" :class="{ '!text-green-500': tabStore.getCurrent()?.execution === 'local' }" />
      <span class="text-xs">Local</span>
    </SecondaryButton>
    <template v-if="tabStore.getCurrent().path !== settingsStore.settings.laravelPath">
      <DropDown>
        <template v-slot:trigger>
          <SecondaryButton class="!px-2">
            <DockerIcon
              class="size-4 mr-1"
              :class="{ '!text-green-500': tabStore.getCurrent()?.execution === 'docker' }"
            />
            <span class="text-xs max-w-[150px] truncate">
              <template
                v-if="tabStore.getCurrent().execution === 'docker' && tabStore.getCurrent()?.docker.container_name"
              >
                {{ tabStore.getCurrent()?.docker.container_name }}
              </template>
              <template v-else> Docker </template>
            </span>
            <ChevronDownIcon class="size-4 ml-1" />
          </SecondaryButton>
        </template>
        <div>
          <DropDownItem
            v-if="tabStore.getCurrent()?.docker.container_name"
            @click="changeExecution('docker')"
            class="truncate"
          >
            {{ tabStore.getCurrent()?.docker.container_name }}
          </DropDownItem>
          <DropDownItem @click="dockerModal.openModal()"> Connect </DropDownItem>
        </div>
      </DropDown>
      <!-- <SecondaryButton class="!px-2" :class="{ '!bg-primary-600': tabStore.getCurrent().execution === 'ssh' }">
        <ServerIcon class="size-4 mr-1" />
        <span class="text-xs"> SSH </span>
        <ChevronDownIcon class="size-4 ml-2" />
      </SecondaryButton> -->
    </template>
    <SecondaryButton
      class="!px-2"
      v-tippy="{ content: 'Close', placement: 'right' }"
      @click="tabStore.removeTab(tab.id)"
    >
      <XMarkIcon class="size-4" />
    </SecondaryButton>
    <Modal title="Connect to Docker" ref="dockerModal" size="xl">
      <DockerView @connected="dockerModal.closeModal()" />
    </Modal>
  </div>
</template>
