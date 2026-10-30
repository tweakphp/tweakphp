<script setup lang="ts">
  import { computed, onBeforeUnmount, Ref, ref, watch } from 'vue'
  import { ListboxContent, ListboxFilter, ListboxItem, ListboxRoot } from 'reka-ui'
  import Modal from '../Modal.vue'
  import { ModalSize } from '../../../types/modal.type'
  import Divider from '../Divider.vue'
  import Editor from '../Editor.vue'
  import AutoScrollText from '../AutoScrollText.vue'
  import PrimaryButton from '../PrimaryButton.vue'
  import SecondaryButton from '../SecondaryButton.vue'
  import EmptyState from '../EmptyState.vue'
  import SnippetFormModal from './SnippetFormModal.vue'
  import DeleteSnippetModal from './DeleteSnippetModal.vue'
  import ConfirmModal from './ConfirmModal.vue'
  import { useSnippetsStore } from '../../stores/snippets'
  import { useTabsStore } from '../../stores/tabs'
  import { useSettingsStore } from '../../stores/settings'
  import { Snippet } from '../../../types/snippet.type'
  import {
    MagnifyingGlassIcon,
    PencilIcon,
    PlusIcon,
    TrashIcon,
    ArrowDownOnSquareIcon,
    ArrowPathRoundedSquareIcon,
  } from '@heroicons/vue/24/outline'

  const snippetsStore = useSnippetsStore()
  const tabsStore = useTabsStore()
  const settingsStore = useSettingsStore()

  const modal = ref<InstanceType<typeof Modal> | null>(null)
  const searchQuery = ref('')
  const selected: Ref<Snippet | null> = ref(null)
  const snippetFormModal = ref()
  const pendingDelete: Ref<Snippet | null> = ref(null)
  const deleteSnippetModal = ref()
  const replaceModal = ref<InstanceType<typeof ConfirmModal> | null>(null)
  const actionError = ref('')
  const loading = computed(() => snippetsStore.loading)
  const searchError = computed(() => actionError.value || snippetsStore.searchError)

  let searchTimeout: ReturnType<typeof setTimeout> | null = null

  const currentTab = computed(() => tabsStore.getCurrent())
  const activeSelection = computed(() => {
    if (loading.value || searchError.value || snippetsStore.searchTerm !== searchQuery.value || !selected.value) {
      return null
    }
    return snippetsStore.snippets.find(snippet => snippet.id === selected.value?.id) ?? null
  })

  const emptyMessage = computed(() => {
    if (searchQuery.value) {
      return `No snippets matching "${searchQuery.value}".`
    }
    return 'No snippets yet. Create one using New snippet or save code from the editor.'
  })

  const openModal = () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    actionError.value = ''
    searchQuery.value = ''
    if (searchTimeout) clearTimeout(searchTimeout)
    void snippetsStore.search('').catch(() => {})
    modal.value?.openModal()
  }

  const closeModal = () => {
    modal.value?.closeModal()
  }

  defineExpose({ openModal, closeModal })

  const editSelected = () => {
    if (activeSelection.value) {
      openEditSnippetForm(activeSelection.value)
    }
  }

  const guardSearchEnter = (event: KeyboardEvent) => {
    if (event.isComposing) {
      event.stopImmediatePropagation()
    } else if (!activeSelection.value) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }

  // keep the selection in sync with the highlighted option so the preview
  // follows arrow-key navigation (and Enter edits the highlighted snippet)
  const onHighlight = (payload: { value: unknown } | undefined) => {
    const snippet = payload?.value as Snippet | undefined
    if (snippet && !loading.value && !searchError.value) {
      selected.value = snippet
    }
  }

  watch(
    () => snippetsStore.snippets,
    snippets => {
      selected.value = snippets.find(s => s.id === selected.value?.id) ?? snippets[0] ?? null
    },
    { immediate: true, deep: true }
  )

  watch(
    searchQuery,
    term => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
      actionError.value = ''
      selected.value = null
      snippetsStore.setSearchTerm(term)
      searchTimeout = setTimeout(() => {
        void snippetsStore.search(term).catch(() => {})
      }, 200)
    },
    { flush: 'sync' }
  )

  onBeforeUnmount(() => {
    if (searchTimeout) clearTimeout(searchTimeout)
  })

  const onSearchEscape = (event: KeyboardEvent) => {
    if (searchQuery.value) {
      event.preventDefault()
      event.stopPropagation()
      searchQuery.value = ''
    }
  }

  const formatDate = (date?: string): string => {
    if (!date) return ''
    return new Date(date).toLocaleString()
  }

  const snippetTitle = (snippet: Snippet): string => {
    return snippet.title?.trim() ? snippet.title : 'Untitled'
  }

  const openNewSnippetForm = () => {
    snippetFormModal.value.openModal()
  }

  const openEditSnippetForm = (snippet: Snippet) => {
    snippetFormModal.value.openModal(snippet)
  }

  const onSnippetSaved = (snippet: Snippet) => {
    selected.value = snippetsStore.snippets.find(s => s.id === snippet.id) ?? snippetsStore.snippets[0] ?? null
  }

  const requestDeleteSnippet = (snippet: Snippet) => {
    if (!snippet.id) return
    pendingDelete.value = snippet
    deleteSnippetModal.value.openModal()
  }

  const onSnippetDeleted = () => {
    if (selected.value?.id === pendingDelete.value?.id) {
      selected.value = snippetsStore.snippets[0] ?? null
    }
    pendingDelete.value = null
  }

  const insertIntoTab = (mode: 'insert' | 'replace') => {
    const target = currentTab.value
    if (!target || target.type !== 'code' || !activeSelection.value) {
      return
    }
    snippetsStore.requestInsert(target.id, activeSelection.value.code ?? '', mode)
    closeModal()
  }
</script>

<template>
  <Modal ref="modal" title="Snippets" :size="ModalSize.FIVE_XL" @open-auto-focus="($event as Event).preventDefault()">
    <ListboxRoot
      v-model="selected"
      by="id"
      selection-behavior="replace"
      class="h-[65vh] flex flex-col gap-3"
      @highlight="onHighlight"
    >
      <div class="flex items-center justify-end gap-2">
        <div class="relative w-full max-w-md">
          <MagnifyingGlassIcon
            class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none"
          />
          <ListboxFilter
            v-model="searchQuery"
            auto-focus
            aria-label="Search snippets"
            placeholder="Search snippets..."
            class="w-full h-8 pl-9 pr-3 text-sm rounded-md outline focus:!outline-primary-500 transition-colors"
            :style="{
              backgroundColor: settingsStore.colors.backgroundLight,
              color: settingsStore.colors.foreground,
              outlineColor: settingsStore.colors.border,
            }"
            @keydown.enter.capture="guardSearchEnter"
            @keydown.enter="editSelected"
            @keydown.esc="onSearchEscape"
          />
        </div>
        <PrimaryButton
          v-tippy="{ content: 'New snippet', placement: 'bottom' }"
          class="gap-2"
          @click="openNewSnippetForm"
        >
          <PlusIcon class="w-4 h-4" /><span>New snippet</span>
        </PrimaryButton>
      </div>
      <Divider class="!my-0" />

      <div
        v-if="loading || searchError || snippetsStore.snippets.length === 0"
        class="flex-1 flex flex-col gap-3 items-center justify-center"
        role="status"
      >
        <EmptyState :message="loading ? 'Loading snippets…' : searchError || emptyMessage" />
        <SecondaryButton v-if="searchQuery && !loading && !searchError" @click="searchQuery = ''"
          >Clear search</SecondaryButton
        >
        <SecondaryButton
          v-if="searchError && !loading"
          @click="
            snippetsStore
              .search(searchQuery)
              .then(() => (actionError = ''))
              .catch(() => {})
          "
          >Try again</SecondaryButton
        >
      </div>

      <div v-else class="flex-1 flex gap-4 min-h-0">
        <div class="w-1/3 min-w-[220px] max-w-[320px] flex flex-col gap-2 min-h-0">
          <ListboxContent class="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1 rounded-md">
            <ListboxItem
              v-for="snippet in snippetsStore.snippets"
              :key="snippet.id"
              :value="snippet"
              class="rounded-md border p-2 cursor-pointer transition-colors group outline-none data-[state=checked]:!border-primary-500"
              :style="{
                backgroundColor: settingsStore.colors.backgroundLight,
                borderColor: settingsStore.colors.border,
              }"
            >
              <AutoScrollText class="text-sm font-medium">{{ snippetTitle(snippet) }}</AutoScrollText>
              <div class="text-[10px] opacity-40 mt-1">{{ formatDate(snippet.updated_at) }}</div>
            </ListboxItem>
          </ListboxContent>
        </div>

        <div
          v-if="selected"
          class="flex-1 flex flex-col min-w-0 rounded-md border overflow-hidden"
          :style="{ borderColor: settingsStore.colors.border }"
        >
          <div
            class="flex items-center justify-between gap-2 px-3 py-2 border-b"
            :style="{ borderColor: settingsStore.colors.border }"
          >
            <AutoScrollText class="flex-1 text-sm font-medium">{{ snippetTitle(selected) }}</AutoScrollText>
          </div>
          <div class="flex-1 min-h-0">
            <Editor
              :key="`snippet-preview-${selected.id}-${selected.updated_at}`"
              :editor-id="`snippet-preview-${selected.id}-${selected.updated_at}`"
              :value="selected.code"
              language="php"
              :readonly="true"
              :wrap="true"
            />
          </div>
          <div
            class="flex flex-wrap items-center gap-2 p-3 border-t"
            :style="{ borderColor: settingsStore.colors.border }"
          >
            <PrimaryButton class="gap-2" :disabled="currentTab?.type !== 'code'" @click="insertIntoTab('insert')">
              <ArrowDownOnSquareIcon class="size-4" /><span>Insert at cursor</span>
            </PrimaryButton>
            <SecondaryButton class="gap-2" @click="openEditSnippetForm(selected)">
              <PencilIcon class="size-4" /><span>Edit</span>
            </SecondaryButton>
            <SecondaryButton class="gap-2" @click="requestDeleteSnippet(selected)">
              <TrashIcon class="size-4" /><span>Delete</span>
            </SecondaryButton>
            <SecondaryButton
              class="gap-2 ml-auto"
              :disabled="currentTab?.type !== 'code'"
              @click="replaceModal?.openModal()"
            >
              <ArrowPathRoundedSquareIcon class="size-4" /><span>Replace all</span>
            </SecondaryButton>
          </div>
        </div>

        <div v-else class="flex-1 flex items-center justify-center opacity-60">
          <div class="text-sm">Select a snippet to preview</div>
        </div>
      </div>
    </ListboxRoot>

    <SnippetFormModal ref="snippetFormModal" @saved="onSnippetSaved" />
    <DeleteSnippetModal
      ref="deleteSnippetModal"
      :snippet="pendingDelete"
      @deleted="onSnippetDeleted"
      @error="actionError = 'Could not delete the snippet. Please try again.'"
    />
    <ConfirmModal
      ref="replaceModal"
      title="Replace all code?"
      confirm-text="Replace all"
      @confirm="insertIntoTab('replace')"
    >
      This will replace all code in {{ currentTab?.name || 'the current tab' }} with the selected snippet.
    </ConfirmModal>
  </Modal>
</template>
