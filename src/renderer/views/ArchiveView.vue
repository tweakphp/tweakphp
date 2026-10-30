<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { ArrowPathIcon, ChevronDownIcon, TrashIcon } from '@heroicons/vue/24/outline'
  import Container from '../components/Container.vue'
  import Editor from '../components/Editor.vue'
  import { useSettingsStore } from '../stores/settings'
  import { useArchiveStore } from '../stores/archive'
  import { ArchivedTab } from '../../types/tab.type'
  import SecondaryButton from '../components/SecondaryButton.vue'
  import EmptyState from '../components/EmptyState.vue'
  import ConfirmModal from '../components/modals/ConfirmModal.vue'

  const settingsStore = useSettingsStore()
  const archiveStore = useArchiveStore()

  const confirmModal = ref<InstanceType<typeof ConfirmModal> | null>(null)

  // Tab rendered in the confirm modal body: kept until the next
  // askForceDelete so the name stays visible during the close animation.
  const pendingDelete = ref<ArchivedTab | null>(null)
  // Action identity: cleared on every close path so a stray click during the
  // leave animation cannot re-run the delete.
  const pendingDeleteId = ref<number | null>(null)

  // Project whose code preview is expanded (one at a time)
  const expandedId = ref<number | null>(null)

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

  const toggleExpand = (tab: ArchivedTab) => {
    expandedId.value = expandedId.value === tab.id ? null : tab.id
  }

  const restore = (tab: ArchivedTab) => {
    if (expandedId.value === tab.id) {
      expandedId.value = null
    }
    void archiveStore.restore(tab.id)
  }

  const askForceDelete = (tab: ArchivedTab) => {
    pendingDelete.value = tab
    pendingDeleteId.value = tab.id
    confirmModal.value?.openModal()
  }

  // Programmatic close (ConfirmModal's closeModal does not emit `closed`,
  // which only fires for reka-initiated closes: X, Esc, outside click).
  const closeAndReset = () => {
    pendingDeleteId.value = null
  }

  const cancelForceDelete = () => {
    closeAndReset()
  }

  const onClosed = () => {
    pendingDeleteId.value = null
  }

  const confirmForceDelete = () => {
    const id = pendingDeleteId.value
    closeAndReset()
    if (id !== null) {
      if (expandedId.value === id) {
        expandedId.value = null
      }
      void archiveStore.forceDelete(id)
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
                class="rounded-lg border"
                :style="{ borderColor: settingsStore.colors.border }"
              >
                <div
                  class="flex items-center gap-3 p-2 cursor-pointer select-none hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                  :class="expandedId === tab.id ? 'rounded-t-lg' : 'rounded-lg'"
                  role="button"
                  tabindex="0"
                  :aria-expanded="expandedId === tab.id"
                  title="Toggle code preview"
                  @click="toggleExpand(tab)"
                  @keydown.enter.prevent="toggleExpand(tab)"
                  @keydown.space.prevent="toggleExpand(tab)"
                >
                  <ChevronDownIcon
                    class="size-4 shrink-0 opacity-50 transition-transform"
                    :class="expandedId === tab.id ? 'rotate-180' : ''"
                  />
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
                  <SecondaryButton
                    without-border
                    class="!px-2 gap-1"
                    title="Restore project"
                    @click.stop="restore(tab)"
                  >
                    <ArrowPathIcon class="size-4" />
                    Restore
                  </SecondaryButton>
                  <SecondaryButton
                    class="!px-2 hover:!text-red-200 hover:bg-red-700 gap-1"
                    title="Delete permanently"
                    @click.stop="askForceDelete(tab)"
                    without-border
                  >
                    <TrashIcon class="size-4" />
                    Delete
                  </SecondaryButton>
                </div>
                <div
                  v-if="expandedId === tab.id"
                  class="border-t"
                  :style="{ borderColor: settingsStore.colors.border }"
                >
                  <div class="relative h-72 overflow-hidden">
                    <Editor
                      :key="tab.id"
                      :editor-id="'archive-' + tab.id"
                      :path="tab.path ?? ''"
                      language="php"
                      :value="tab.code"
                      readonly
                    />
                  </div>
                </div>
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
    @closed="onClosed"
  >
    <p>
      Are you sure you want to permanently delete
      <span class="font-semibold">{{ pendingDelete?.name }}</span> project?
    </p>
    <p class="mt-2 opacity-60">This cannot be undone.</p>
  </ConfirmModal>
</template>
