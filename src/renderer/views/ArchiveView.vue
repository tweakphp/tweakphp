<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { ArrowPathIcon, TrashIcon } from '@heroicons/vue/24/outline'
  import Container from '../components/Container.vue'
  import { useSettingsStore } from '../stores/settings'
  import { useArchiveStore } from '../stores/archive'
  import { ArchivedTab } from '../../types/tab.type'
  import SecondaryButton from '../components/SecondaryButton.vue'
  import EmptyState from '../components/EmptyState.vue'
  import ConfirmModal from '../components/modals/ConfirmModal.vue'

  const settingsStore = useSettingsStore()
  const archiveStore = useArchiveStore()

  const confirmModal = ref<InstanceType<typeof ConfirmModal> | null>(null)
  const pendingDelete = ref<ArchivedTab | null>(null)

  const trashedTabs = computed(() => archiveStore.trashedTabs)

  const formatArchivedAt = (deletedAt: string | null): string => {
    if (!deletedAt) {
      return ''
    }
    const date = new Date(deletedAt)
    if (isNaN(date.getTime())) {
      return ''
    }
    return date.toLocaleString()
  }

  const restore = (tab: ArchivedTab) => {
    void archiveStore.restore(tab.id)
  }

  const askForceDelete = (tab: ArchivedTab) => {
    pendingDelete.value = tab
    confirmModal.value?.openModal()
  }

  const cancelForceDelete = () => {
    pendingDelete.value = null
  }

  const confirmForceDelete = () => {
    const tab = pendingDelete.value
    pendingDelete.value = null
    if (tab) {
      void archiveStore.forceDelete(tab.id)
    }
  }

  onMounted(() => {
    void archiveStore.loadTrashed()
  })
</script>

<template>
  <Container class="pt-[38px] !overflow-hidden no-scrollbar">
    <div class="h-full overflow-y-auto no-scrollbar">
      <div class="mx-auto w-full max-w-3xl px-8 mt-8 pb-24">
        <h1 class="text-3xl font-semibold tracking-tight">Archive</h1>

        <div class="mt-8 flex flex-col gap-2">
          <template v-if="trashedTabs.length > 0">
            <ul class="flex flex-col gap-2">
              <li
                v-for="tab in trashedTabs"
                :key="tab.id"
                class="flex items-center gap-3 rounded-lg border p-2"
                :style="{ borderColor: settingsStore.colors.border }"
              >
                <span
                  v-if="tab.color || tab.tag"
                  v-tippy="{ content: tab.tag ?? null, placement: 'top' }"
                  class="size-2 rounded-full shrink-0"
                  :class="tab.color ? `bg-${tab.color}-500` : 'border border-current opacity-70'"
                ></span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-sm font-medium">{{ tab.name }}</span>
                  </div>
                  <div v-if="tab.path" class="truncate text-xs opacity-50">{{ tab.path }}</div>
                </div>
                <span
                  v-if="formatArchivedAt(tab.deleted_at)"
                  class="hidden md:block shrink-0 text-xs opacity-50"
                  :title="`Archived ${formatArchivedAt(tab.deleted_at)}`"
                >
                  {{ formatArchivedAt(tab.deleted_at) }}
                </span>
                <SecondaryButton without-border class="!px-2 gap-1" title="Restore project" @click="restore(tab)">
                  <ArrowPathIcon class="size-4" />
                  Restore
                </SecondaryButton>
                <SecondaryButton
                  class="!px-2 hover:!text-red-200 hover:bg-red-700 gap-1"
                  title="Delete permanently"
                  @click="askForceDelete(tab)"
                  without-border
                >
                  <TrashIcon class="size-4" />
                  Delete
                </SecondaryButton>
              </li>
            </ul>
          </template>
          <EmptyState v-else-if="!archiveStore.loading" message="No archived projects" />
        </div>
      </div>
    </div>
  </Container>

  <ConfirmModal
    ref="confirmModal"
    title="Delete permanently"
    confirm-text="Delete permanently"
    @confirm="confirmForceDelete"
    @cancel="cancelForceDelete"
  >
    <p>
      Are you sure you want to permanently delete
      <span class="font-semibold">{{ pendingDelete?.name }}</span> project?
    </p>
    <p class="mt-2 opacity-60">This cannot be undone.</p>
  </ConfirmModal>
</template>
