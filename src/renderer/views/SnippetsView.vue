<script setup lang="ts">
  import { computed, nextTick, onMounted, Ref, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import Container from '../components/Container.vue'
  import Title from '../components/Title.vue'
  import Divider from '../components/Divider.vue'
  import Modal from '../components/Modal.vue'
  import Editor from '../components/Editor.vue'
  import TextInput from '../components/TextInput.vue'
  import PrimaryButton from '../components/PrimaryButton.vue'
  import SecondaryButton from '../components/SecondaryButton.vue'
  import { useSnippetsStore } from '../stores/snippets'
  import { useTabsStore } from '../stores/tabs'
  import { useSettingsStore } from '../stores/settings'
  import { Snippet } from '../../types/snippet.type'
  import { ModalSize } from '../../types/modal.type'
  import {
    MagnifyingGlassIcon,
    PencilIcon,
    PlusIcon,
    TrashIcon,
    DocumentIcon,
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
  const formTitle = ref('')
  const formCode = ref('')
  const formEditorId = ref('snippet-form-new')
  const searchInput = ref<HTMLInputElement | null>(null)
  const listContainer = ref<HTMLElement | null>(null)

  let searchTimeout: ReturnType<typeof setTimeout> | null = null

  const currentTab = computed(() => tabsStore.getCurrent())

  const formModalTitle = computed(() => (editingSnippet.value ? 'Edit Snippet' : 'New Snippet'))

  const selectedIndex = computed(() => snippetsStore.snippets.findIndex(s => s.id === selected.value?.id))

  const scrollSelectedIntoView = () => {
    nextTick(() => {
      listContainer.value
        ?.querySelector(`[data-snippet-id="${selected.value?.id}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    })
  }

  const moveSelection = (delta: number) => {
    const list = snippetsStore.snippets
    if (list.length === 0) return
    let index = selectedIndex.value
    if (index === -1) {
      index = delta > 0 ? 0 : list.length - 1
    } else {
      index = (index + delta + list.length) % list.length
    }
    selected.value = list[index]
    scrollSelectedIntoView()
  }

  const focusList = () => {
    if (snippetsStore.snippets.length === 0) return
    if (!selected.value) {
      selected.value = snippetsStore.snippets[0]
    }
    scrollSelectedIntoView()
    listContainer.value?.focus()
  }

  const editSelected = () => {
    if (selected.value) {
      openEditSnippetForm(selected.value)
    }
  }

  const deleteSelected = () => {
    if (selected.value) {
      removeSnippet(selected.value)
    }
  }

  onMounted(async () => {
    await snippetsStore.ready
    if (!selected.value && snippetsStore.snippets.length > 0) {
      selected.value = snippetsStore.snippets[0]
    }
    searchInput.value?.focus()
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
    formTitle.value = ''
    formCode.value = ''
    formEditorId.value = `snippet-form-new-${Date.now()}`
    snippetFormModal.value.openModal()
  }

  const openEditSnippetForm = (snippet: Snippet) => {
    editingSnippet.value = snippet
    formTitle.value = snippet.title ?? ''
    formCode.value = snippet.code
    formEditorId.value = `snippet-form-${snippet.id}-${Date.now()}`
    snippetFormModal.value.openModal()
  }

  const saveSnippetForm = async () => {
    if (!formCode.value.trim()) {
      alert('Code is required')
      return
    }
    const payload: Snippet = { title: formTitle.value, code: formCode.value }
    if (editingSnippet.value?.id) {
      payload.id = editingSnippet.value.id
    }
    const saved = await snippetsStore.add(payload)
    selected.value = saved
    snippetFormModal.value.closeModal()
    listContainer.value?.focus()
  }

  const removeSnippet = async (snippet: Snippet) => {
    if (!snippet.id) return
    if (confirm(`Are you sure you want to delete "${snippetTitle(snippet)}"?`)) {
      await snippetsStore.remove(snippet.id)
      if (selected.value?.id === snippet.id) {
        selected.value = snippetsStore.snippets[0] ?? null
      }
    }
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
    <div class="h-full flex flex-col p-4 gap-3">
      <div class="flex items-center justify-between gap-3">
        <Title>Snippets</Title>
        <div class="flex items-center gap-2 flex-1 max-w-md">
          <div class="relative w-full">
            <MagnifyingGlassIcon
              class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none"
            />
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="text"
              placeholder="Search snippets..."
              class="w-full h-8 pl-9 pr-3 text-sm rounded-md outline focus:!outline-primary-500 transition-colors"
              @keydown.down.prevent="focusList"
              @keydown.up.prevent="focusList"
              @keydown.enter.prevent="editSelected"
              :style="{
                backgroundColor: settingsStore.colors.backgroundLight,
                color: settingsStore.colors.foreground,
                outlineColor: settingsStore.colors.border,
              }"
            />
          </div>
          <PrimaryButton
            v-tippy="{ content: 'New snippet', placement: 'bottom' }"
            class="!h-8 !px-0 w-8"
            @click="openNewSnippetForm"
          >
            <PlusIcon class="w-4 h-4" />
          </PrimaryButton>
        </div>
      </div>
      <Divider />

      <div v-if="snippetsStore.snippets.length === 0" class="flex-1 flex items-center justify-center">
        <div class="text-center space-y-2 opacity-60">
          <DocumentIcon class="w-12 h-12 mx-auto stroke-1" />
          <div class="text-sm" v-if="searchQuery">No snippets matching "{{ searchQuery }}"</div>
          <div class="text-sm" v-else>No snippets yet. Select code in the editor and press Cmd/Ctrl+Shift+S.</div>
        </div>
      </div>

      <div v-else class="flex-1 flex gap-4 min-h-0">
        <div class="w-1/3 min-w-[220px] max-w-[320px] flex flex-col gap-2 min-h-0">
          <div
            ref="listContainer"
            tabindex="0"
            class="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1 outline-none rounded-md focus-visible:ring-1 focus-visible:ring-primary-500"
            @keydown.up.prevent="moveSelection(-1)"
            @keydown.down.prevent="moveSelection(1)"
            @keydown.enter.prevent="editSelected"
            @keydown.delete.prevent="deleteSelected"
            @keydown.esc="searchInput?.focus()"
          >
            <div
              v-for="snippet in snippetsStore.snippets"
              :key="snippet.id"
              :data-snippet-id="snippet.id"
              @click="selected = snippet"
              class="rounded-md border p-2 cursor-pointer transition-colors group"
              :class="{ '!border-primary-500': selected?.id === snippet.id }"
              :style="{
                backgroundColor: settingsStore.colors.backgroundLight,
                borderColor: settingsStore.colors.border,
              }"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium truncate">{{ snippetTitle(snippet) }}</span>
                <div class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    @click.stop="openEditSnippetForm(snippet)"
                    class="p-1"
                    v-tippy="{ content: 'Edit', placement: 'top' }"
                  >
                    <PencilIcon class="size-4 hover:text-blue-500" />
                  </button>
                  <button
                    type="button"
                    @click.stop="removeSnippet(snippet)"
                    class="p-1"
                    v-tippy="{ content: 'Delete', placement: 'top' }"
                  >
                    <TrashIcon class="size-4 hover:text-red-500" />
                  </button>
                </div>
              </div>
              <div class="text-[10px] opacity-40 mt-1">{{ formatDate(snippet.updated_at) }}</div>
            </div>
          </div>
          <div class="text-[10px] opacity-40 text-center select-none">↑↓ navigate · Enter edit · Del delete</div>
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
                class="!px-2"
                v-tippy="{ content: 'Edit snippet', placement: 'bottom' }"
                @click="openEditSnippetForm(selected)"
              >
                <PencilIcon class="size-4 mr-1" />
                <span class="text-xs">Edit</span>
              </SecondaryButton>
              <SecondaryButton
                class="!px-2"
                :disabled="!currentTab"
                v-tippy="{
                  content: currentTab ? 'Insert at cursor position' : 'Open a project first',
                  placement: 'bottom',
                }"
                @click="insertIntoTab('insert')"
              >
                <ArrowDownOnSquareIcon class="size-4 mr-1" />
                <span class="text-xs">Insert at cursor</span>
              </SecondaryButton>
              <SecondaryButton
                class="!px-2"
                :disabled="!currentTab"
                v-tippy="{
                  content: currentTab ? 'Replace all code in the tab' : 'Open a project first',
                  placement: 'bottom',
                }"
                @click="insertIntoTab('replace')"
              >
                <ArrowPathRoundedSquareIcon class="size-4 mr-1" />
                <span class="text-xs">Replace all</span>
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
    </div>

    <Modal :title="formModalTitle" ref="snippetFormModal" :size="ModalSize.THREE_XL">
      <form class="space-y-3" @submit.prevent="saveSnippetForm">
        <TextInput v-model="formTitle" placeholder="Title (optional)" class="w-full" />
        <Editor
          :key="formEditorId"
          v-model:value="formCode"
          :editor-id="formEditorId"
          class="w-full border rounded-md p-1"
          :style="{
            borderColor: settingsStore.colors.border,
            height: '400px',
          }"
          language="php"
        />
        <div class="flex justify-end gap-2">
          <SecondaryButton @click="snippetFormModal.closeModal()">Cancel</SecondaryButton>
          <PrimaryButton type="submit">Save Snippet</PrimaryButton>
        </div>
      </form>
    </Modal>
  </Container>
</template>
