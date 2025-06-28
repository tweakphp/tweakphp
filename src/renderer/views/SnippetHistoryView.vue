<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
  import { Splitpanes, Pane } from 'splitpanes'
  import 'splitpanes/dist/splitpanes.css'
  import Divider from '../components/Divider.vue'
  import PrimaryButton from '../components/PrimaryButton.vue'
  import Editor from '../components/Editor.vue'
  import Container from '../components/Container.vue'
  import { Snippet } from '../../types/snippet.type'
  import TextInput from '../components/TextInput.vue'
  import TagsInput from '../components/TagsInput.vue'
  import { z } from 'zod'
  import { useTabsStore } from '../stores/tabs'
  import { refAutoReset } from '@vueuse/core'

  const tabsStore = useTabsStore()

  const emit = defineEmits<{
    selected: [value: Snippet]
  }>()

  const loadingEdit = ref<boolean>(false)
  const confirmDelete = refAutoReset<boolean>(false, 5000) // Reset after 5 seconds

  const snippetSelected = ref<Snippet | null>(null)
  const searchQuery = ref<string>('')
  const enableEditMode = ref<boolean>(false)
  const snippetName = ref('')
  const snippetTags = ref<string[]>([])
  const snippetCode = ref<string>('')
  const snippets = ref<Snippet[] | []>([])
  const snippetTabId = ref<string | number | null>(null)
  const snippetTabName = ref<string | null>(null)

  type SnippetResponse = {
    error?: string
    data: Snippet[] | []
  }

  const handleLoadedSnippets = (snippetResponses: SnippetResponse) => {
    snippets.value = snippetResponses?.data || []
  }

  const sendLoadSnippets = (query: string | null = null) => {
    window.ipcRenderer.send('load-snippets', query)
    window.ipcRenderer.on('load-snippets.reply', handleLoadedSnippets)
  }

  const clickTimeout = ref<number | null>(null)

  const handleClick = (snippet: Snippet, onlyShow = false) => {
    snippetSelected.value = snippet
    if (onlyShow) {
      selectedSnippet()
      return
    }
    if (clickTimeout.value !== null) {
      clearTimeout(clickTimeout.value)
      clickTimeout.value = null
      handleUse()
    } else {
      clickTimeout.value = window.setTimeout(() => {
        selectedSnippet()
        clickTimeout.value = null
      }, 250) // 250 ms delay for double click detection
    }
  }

  const selectedSnippet = () => {
    if (!snippetSelected.value) return
    enableEditMode.value = false
    confirmDelete.value = false
    snippetName.value = snippetSelected.value.name
    snippetTags.value = snippetSelected.value.tags || []
    snippetCode.value = snippetSelected.value.code
    snippetTabId.value = snippetSelected.value.tab_id || null
    snippetTabName.value = snippetSelected.value.tab_name || null
  }

  watch(searchQuery, newQuery => {
    if (newQuery.trim() === '' || newQuery.length > 1) {
      sendLoadSnippets(newQuery.trim())
    }
  })

  onMounted(() => {
    sendLoadSnippets()
  })

  onBeforeUnmount(() => {
    window.ipcRenderer.removeListener('load-snippets.reply', () => {})
    window.ipcRenderer.removeListener('update-snippet.reply', () => {})
  })

  const handleDelete = () => {
    if (!snippetSelected.value) return

    if (!confirmDelete.value) {
      confirmDelete.value = true
      return
    }

    enableEditMode.value = false
    confirmDelete.value = false
    window.ipcRenderer.send('delete-snippet', snippetSelected.value.id)
    window.ipcRenderer.on('delete-snippet.reply', response => {
      if (response.error) {
        console.error('Error deleting snippet:', response.error)
        return
      }

      snippets.value = snippets.value.filter(snippet => snippet.id !== snippetSelected.value?.id)
      snippetSelected.value = null
    })
  }

  const handleUse = () => {
    if (!snippetSelected.value) return
    if (!tabsStore.current) return

    const currentTab = tabsStore.current
    currentTab.code = snippetSelected.value.code
    tabsStore.updateTab(currentTab)
    emit('selected', snippetSelected.value)
  }

  const snippetSchema = z.object({
    id: z.number().int().positive('ID must be a positive integer'),
    name: z.string().min(1, 'Name cannot be empty'),
    code: z.string().min(1, 'Code cannot be empty'),
    tab_id: z.number().optional(),
    tab_name: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })

  const editOrSaveSnippet = () => {
    if (!snippetSelected.value) return

    if (!enableEditMode.value) {
      enableEditMode.value = true
      return
    }

    loadingEdit.value = true

    const payload = {
      id: snippetSelected.value.id,
      name: snippetName.value,
      code: snippetCode.value,
      tab_id: tabsStore.current?.id,
      tab_name: tabsStore.current?.name,
      tags: snippetTags.value,
    }

    const result = snippetSchema.safeParse(payload)

    if (!result.success) {
      console.error('Validation errors:', result.error.errors)
      return
    }

    window.ipcRenderer.send('update-snippet', result.data)
    window.ipcRenderer.on('update-snippet.reply', response => {
      if (response.error) {
        loadingEdit.value = false
        enableEditMode.value = false
        console.error('Error updating snippet:', response.error)
        return
      }
      snippets.value = snippets.value.map(snippet =>
        snippet.id === result.data.id ? { ...snippet, ...result.data } : snippet
      )
      snippetSelected.value = result.data as Snippet
      loadingEdit.value = false
      enableEditMode.value = false
    })
  }
</script>

<template>
  <Container>
    <Splitpanes class="pb-6 max-h-[700px]">
      <pane class="!h-full">
        <div class="flex flex-col gap-4 ml-0.5 mr-2 py-4">
          <div class="relative">
            <TextInput
              v-model="searchQuery"
              id="search"
              class="w-full p-2"
              placeholder="Search snippets by name, tag, or code."
            />
            <button
              v-if="searchQuery.length > 0"
              class="absolute right-2 top-1/2 transform -translate-y-1/2"
              @click="searchQuery = ''"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="size-4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            </button>
          </div>
          <Divider />
        </div>
        <div class="h-full max-h-[400px] flex flex-col">
          <div class="h-full overflow-y-auto pr-2 custom-scrollbar">
            <div class="flex flex-col gap-2">
              <button
                v-for="snippet in snippets"
                :key="snippet.id"
                class="flex items-center justify-between p-1 gap-2 w-full my-0.5 ml-0.5 border-2 border-gray-500 hover:border-gray-400 cursor-pointer rounded transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                :class="[
                  snippetSelected?.id === snippet.id
                    ? 'bg-primary-900/10 outline-none ring-2 ring-primary-500 border-transparent'
                    : '',
                ]"
                @click="handleClick(snippet)"
              >
                <span class="flex flex-col items-start justify-start gap-1 text-start max-w-1/2">
                  <span :class="[snippetSelected?.id === snippet.id ? 'text-primary-600' : '']">
                    {{ snippet.name }}
                  </span>
                  <span
                    v-if="snippet?.tags"
                    class="shrink-0 text-xs text-gray-400 bg-gray-600 px-1 rounded"
                    :class="[snippetSelected?.id === snippet.id ? 'bg-primary-900/40 text-primary-600' : '']"
                  >
                    {{ snippet?.tags.join(', ') }}
                  </span>
                </span>
                <span
                  class="shrink-0"
                  :class="[
                    snippetSelected?.id === snippet.id
                      ? 'bg-primary-900/40 text-primary-600 px-2 rounded'
                      : 'bg-gray-500 px-2 rounded',
                  ]"
                >
                  {{ snippet.tab_name }}
                </span>
              </button>
            </div>
          </div>
          <p v-if="snippets.length > 0" class="text-sm text-gray-500 pt-2">
            One click to select a snippet, two clicks to add it to your code editor.
          </p>
        </div>
      </pane>
      <Pane class="!h-auto">
        <div v-if="snippetSelected">
          <div class="p-2 flex flex-col gap-4">
            <div class="flex justify-between items-center">
              <h2 class="text-lg font-semibold my-2">
                <template v-if="!enableEditMode">
                  <span class="text-gray-500">Show:</span> {{ snippetSelected.name }}
                </template>
                <template v-else> <span class="text-gray-500">Editing:</span> {{ snippetName }} </template>
              </h2>
            </div>
          </div>

          <div v-if="snippetSelected && enableEditMode" class="py-2 px-2 mb-2">
            <div class="grid grid-cols-1 gap-4 items-center px-1">
              <TextInput v-model="snippetName" id="snippet_name" placeholder="Snippet name" />
              <TagsInput
                v-model="snippetTags"
                id="tag_input"
                placeholder="Snippet tags (Enter to add, comma to separate)"
              />
            </div>
          </div>

          <Editor
            v-if="!enableEditMode"
            ref="snippetShow"
            class="min-h-[300px] h-full w-full"
            :key="`snippet-show-${snippetSelected.id + Date.now()}`"
            :editor-id="`snippet-show-${snippetSelected.id + Date.now()}`"
            language="output"
            :value="snippetCode"
            readonly
            :wrap="true"
          />

          <Editor
            v-else
            ref="snippetEdit"
            class="min-h-[300px] h-full w-full"
            :key="`snippet-edit-${snippetSelected.id}`"
            :editor-id="`snippet-edit-${snippetSelected.id}`"
            v-model:value="snippetCode"
            language="php"
            :wrap="true"
            :path="tabsStore.current?.path"
            :auto-focus="true"
          />

          <div class="flex items-center justify-between mt-2">
            <PrimaryButton @click="handleDelete" class="flex items-center gap-1">
              <span v-if="!confirmDelete">Delete</span>
              <span v-else> Are you sure? </span>
            </PrimaryButton>
            <div class="flex justify-center gap-2 items-center">
              <PrimaryButton @click="editOrSaveSnippet" class="flex items-center gap-1">
                <span>{{ enableEditMode ? 'Save' : 'Edit' }}</span>
              </PrimaryButton>
              <PrimaryButton v-if="!enableEditMode" @click="handleUse">
                <div class="flex items-center gap-1">
                  <span> Use in editor </span>
                </div>
              </PrimaryButton>
            </div>
          </div>
        </div>
        <div v-else class="flex items-center justify-center p-10 h-full text-center">
          <p v-if="snippets.length > 0" class="text-sm text-gray-500">
            Select a snippet from the list and add it to your code editor. If a snippet is selected, you can edit its
            code, delete it, or use it in your current editor.
          </p>
          <p v-else class="text-sm text-gray-500">
            No snippets available. You can create a new snippet by selecting some code and clicking the left mouse
            button “Save Snippet”, or by pressing Win + Shift + S (Cmd + Shift + S on Mac).
          </p>
        </div>
      </Pane>
    </Splitpanes>
  </Container>
</template>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent; /* o un colore chiaro */
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(100, 100, 100, 0.5);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: content-box;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(100, 100, 100, 0.8);
  }
</style>
