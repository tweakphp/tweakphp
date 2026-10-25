<script setup lang="ts">
  import { computed, onMounted, Ref, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { ListboxContent, ListboxFilter, ListboxItem, ListboxRoot } from 'reka-ui'
  import Container from '../components/Container.vue'
  import Title from '../components/Title.vue'
  import Divider from '../components/Divider.vue'
  import Editor from '../components/Editor.vue'
  import PrimaryButton from '../components/PrimaryButton.vue'
  import SecondaryButton from '../components/SecondaryButton.vue'
  import RowActions from '../components/interactions/RowActions.vue'
  import EmptyState from '../components/EmptyState.vue'
  import SnippetFormModal from '../components/modals/SnippetFormModal.vue'
  import DeleteSnippetModal from '../components/modals/DeleteSnippetModal.vue'
  import { useSnippetsStore } from '../stores/snippets'
  import { useTabsStore } from '../stores/tabs'
  import { useSettingsStore } from '../stores/settings'
  import { Snippet } from '../../types/snippet.type'
  import {
    MagnifyingGlassIcon,
    PencilIcon,
    PlusIcon,
    ArrowDownOnSquareIcon,
    ArrowPathRoundedSquareIcon,
  } from '@heroicons/vue/24/outline'

  const snippetsStore = useSnippetsStore()
  const tabsStore = useTabsStore()
  const settingsStore = useSettingsStore()
  const router = useRouter()

  const searchQuery = ref('')
  const selected: Ref<Snippet | null> = ref(null)
  const snippetFormModal = ref()
  const editingSnippet: Ref<Snippet | null> = ref(null)
  const pendingDelete: Ref<Snippet | null> = ref(null)
  const deleteSnippetModal = ref()
  const searchInput = ref<InstanceType<typeof ListboxFilter> | null>(null)

  let searchTimeout: ReturnType<typeof setTimeout> | null = null

  const currentTab = computed(() => tabsStore.getCurrent())

  const emptyMessage = computed(() => {
    if (searchQuery.value) {
      return `No snippets matching "${searchQuery.value}".`
    }
    return 'No snippets yet. Select code in the editor and press Cmd/Ctrl+Shift+S.'
  })

  const editSelected = () => {
    if (selected.value) {
      openEditSnippetForm(selected.value)
    }
  }

  // keep the selection in sync with the highlighted option so the preview
  // follows arrow-key navigation (and Enter edits the highlighted snippet)
  const onHighlight = (payload: { value: unknown } | undefined) => {
    const snippet = payload?.value as Snippet | undefined
    if (snippet) {
      selected.value = snippet
    }
  }

  onMounted(async () => {
    await snippetsStore.ready
    if (!selected.value && snippetsStore.snippets.length > 0) {
      selected.value = snippetsStore.snippets[0]
    }
  })

  watch(searchQuery, term => {
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
    searchTimeout = setTimeout(async () => {
      await snippetsStore.search(term)
      if (selected.value && !snippetsStore.snippets.find(s => s.id === selected.value?.id)) {
        selected.value = snippetsStore.snippets[0] ?? null
      }
    }, 200)
  })

  const formatDate = (date?: string): string => {
    if (!date) return ''
    return new Date(date).toLocaleString()
  }

  const snippetTitle = (snippet: Snippet): string => {
    return snippet.title?.trim() ? snippet.title : 'Untitled'
  }

  const openNewSnippetForm = () => {
    editingSnippet.value = null
    snippetFormModal.value.openModal()
  }

  const openEditSnippetForm = (snippet: Snippet) => {
    editingSnippet.value = snippet
    snippetFormModal.value.openModal()
  }

  const onSnippetSaved = (snippet: Snippet) => {
    selected.value = snippet
    searchInput.value?.$el?.focus()
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
    if (!target || !selected.value) {
      return
    }
    snippetsStore.requestInsert(target.id, selected.value.code ?? '', mode)
    router.push({ name: 'code', params: { id: target.id } })
  }
</script>

<template>
  <Container class="pt-[38px]">
    <ListboxRoot
      v-model="selected"
      by="id"
      selection-behavior="replace"
      class="h-full flex flex-col p-4 gap-3"
      @highlight="onHighlight"
    >
      <div class="flex items-center justify-between gap-3">
        <Title>Snippets</Title>
        <div class="flex items-center gap-2 flex-1 max-w-md">
          <div class="relative w-full">
            <MagnifyingGlassIcon
              class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none"
            />
            <ListboxFilter
              ref="searchInput"
              v-model="searchQuery"
              auto-focus
              placeholder="Search snippets..."
              class="w-full h-8 pl-9 pr-3 text-sm rounded-md outline focus:!outline-primary-500 transition-colors"
              :style="{
                backgroundColor: settingsStore.colors.backgroundLight,
                color: settingsStore.colors.foreground,
                outlineColor: settingsStore.colors.border,
              }"
              @keydown.enter="editSelected"
              @keydown.esc="searchQuery = ''"
            />
          </div>
          <PrimaryButton
            v-tippy="{ content: 'New snippet', placement: 'bottom' }"
            class="!px-0 w-8"
            @click="openNewSnippetForm"
          >
            <PlusIcon class="w-4 h-4" />
          </PrimaryButton>
        </div>
      </div>
      <Divider />

      <div v-if="snippetsStore.snippets.length === 0" class="flex-1 flex items-center justify-center">
        <EmptyState :message="emptyMessage" />
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
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium truncate">{{ snippetTitle(snippet) }}</span>
                <div class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <RowActions @edit="openEditSnippetForm(snippet)" @remove="requestDeleteSnippet(snippet)" />
                </div>
              </div>
              <div class="text-[10px] opacity-40 mt-1">{{ formatDate(snippet.updated_at) }}</div>
            </ListboxItem>
          </ListboxContent>
          <div class="text-[10px] opacity-40 text-center select-none">↑↓ navigate · Enter edit</div>
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
            <span class="text-sm font-medium truncate">{{ snippetTitle(selected) }}</span>
            <div class="flex items-center gap-2">
              <SecondaryButton
                class="!px-2 gap-1"
                withoutBorder
                v-tippy="{ content: 'Edit snippet', placement: 'bottom' }"
                @click="openEditSnippetForm(selected)"
              >
                <PencilIcon class="size-4" /><span>Edit</span>
              </SecondaryButton>
              <SecondaryButton
                class="!px-2 gap-1"
                withoutBorder
                :disabled="!currentTab"
                v-tippy="{
                  content: currentTab ? 'Insert at cursor position' : 'Open a project first',
                  placement: 'bottom',
                }"
                @click="insertIntoTab('insert')"
              >
                <ArrowDownOnSquareIcon class="size-4" /><span>Insert at cursor</span>
              </SecondaryButton>
              <SecondaryButton
                class="!px-2 gap-1"
                withoutBorder
                :disabled="!currentTab"
                v-tippy="{
                  content: currentTab ? 'Replace all code in the tab' : 'Open a project first',
                  placement: 'bottom',
                }"
                @click="insertIntoTab('replace')"
              >
                <ArrowPathRoundedSquareIcon class="size-4" /><span>Replace all</span>
              </SecondaryButton>
            </div>
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
        </div>

        <div v-else class="flex-1 flex items-center justify-center opacity-60">
          <div class="text-sm">Select a snippet to preview</div>
        </div>
      </div>
    </ListboxRoot>

    <SnippetFormModal ref="snippetFormModal" :snippet="editingSnippet" @saved="onSnippetSaved" />
    <DeleteSnippetModal ref="deleteSnippetModal" :snippet="pendingDelete" @deleted="onSnippetDeleted" />
  </Container>
</template>
