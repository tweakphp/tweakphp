<script setup lang="ts">
  import { useSettingsStore } from '@/stores/settings'
  import { ContextMenuContent, ContextMenuItem, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'reka-ui'
  import { computed, ref } from 'vue'
  import Modal from '@/components/Modal.vue'
  import { useTabsStore } from '@/stores/tabs'
  import ChangeNameProject from '@/views/ChangeNameProject.vue'
  const changeNameProject = ref()
  import { Tab } from '../../types/tab.type'
  import TrashIcon from '@/components/icons/TrashIcon.vue'

  const settingsStore = useSettingsStore()
  const tabsStore = useTabsStore()

  const props = defineProps<{
    tab: Tab
  }>()

  const lastFolderName = computed(() => {
    const pathParts = props.tab.path.split(/[/\\]/)
    return pathParts[pathParts.length - 1] || null
  })

  function openModalChangeName() {
    changeNameProject.value.openModal()
  }

  function goToFolder() {
    window.ipcRenderer.send('source.openPath', props.tab.path)
  }

  function removeTab() {
    tabsStore.removeTab(props.tab.id)
  }

  const hoverChangeName = ref(false)
  const hoverGoToFolder = ref(false)
  const hoverRemoveTab = ref(false)
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        class="text-sm p-1 w-[200px] -ml-1 z-50 outline focus:!outline-primary-500 rounded-md grid grid-cols-1 gap-1 border shadow-lg"
        :style="{
          backgroundColor: settingsStore.colors.backgroundLight,
          color: settingsStore.colors.foreground,
          outlineColor: settingsStore.colors.border,
          borderColor: settingsStore.colors.border,
        }"
        :side-offset="5"
      >
        <ContextMenuItem
          value="Change Name"
          @click="openModalChangeName"
          @mouseover="hoverChangeName = true"
          @mouseleave="hoverChangeName = false"
          :class="['group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer']"
          :style="{
            color: settingsStore.colors.foreground,
            backgroundColor: hoverChangeName ? settingsStore.colors.background : settingsStore.colors.backgroundLight,
          }"
        >
          Change name
        </ContextMenuItem>
        <ContextMenuItem
          value="Go to folder"
          @click="goToFolder"
          @mouseover="hoverGoToFolder = true"
          @mouseleave="hoverGoToFolder = false"
          :class="['group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer']"
          :style="{
            color: settingsStore.colors.foreground,
            backgroundColor: hoverGoToFolder ? settingsStore.colors.background : settingsStore.colors.backgroundLight,
          }"
        >
          Go to folder<span v-if="lastFolderName">&nbsp;"{{ lastFolderName }}"</span>
        </ContextMenuItem>
        <ContextMenuSeparator class="h-[1px] border-t border-gray-200/20" />
        <ContextMenuItem
          value="Remove tab"
          @click="removeTab"
          @mouseover="hoverRemoveTab = true"
          @mouseleave="hoverRemoveTab = false"
          :class="['group flex w-full items-center rounded-md py-1 px-2 text-xs min-w-[100px] truncate cursor-pointer']"
          :style="{
            color: settingsStore.colors.foreground,
            backgroundColor: hoverRemoveTab ? settingsStore.colors.background : settingsStore.colors.backgroundLight,
          }"
        >
          <div class="flex items-center justify-start gap-1">
            <TrashIcon class="w-3 h-3 shrink-0" />
            <span>Remove</span>
          </div>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
  <Modal title="Change name" ref="changeNameProject" size="xl">
    <ChangeNameProject @opened="changeNameProject.closeModal()" :tab="tab" />
  </Modal>
</template>
