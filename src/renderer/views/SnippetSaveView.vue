<script setup lang="ts">
  import Container from '../components/Container.vue'
  import PrimaryButton from '../components/PrimaryButton.vue'
  import Divider from '../components/Divider.vue'
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import ArrowPathIcon from '../components/icons/ArrowPathIcon.vue'
  import TextInput from '../components/TextInput.vue'
  import { useTabsStore } from '../stores/tabs'
  import { useSnippetStore } from '../stores/snippet'
  import Editor from '@/components/Editor.vue'
  import { Snippet } from '../../types/snippet.type.ts'
  import TagsInput from '@/components/TagsInput.vue'
  import { z } from 'zod'
  import SwitchInput from '@/components/SwitchInput.vue'

  const emit = defineEmits(['saved'])
  const tabsStore = useTabsStore()
  const snippetStore = useSnippetStore()

  const loading = ref<boolean>(false)
  const saveTabRef = ref<boolean>(false)
  const errorResponse = ref<string>('')
  const snippetName = ref('')
  const snippetTags = ref<string[]>([])

  const snippetCode = computed(() => {
    return snippetStore.getCode() || ''
  })

  const snippetSchema = z.object({
    code: z.string().min(1, 'Code cannot be empty'),
    name: z.string().min(1, 'Name cannot be empty'),
    tab_id: z.number().nullable().optional(),
    tab_name: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
  })

  const saveSnippet = async () => {
    loading.value = true
    errorResponse.value = ''

    const payload: Omit<Snippet, 'id' | 'created_at' | 'updated_at'> = {
      code: snippetCode.value,
      name: snippetName.value,
      tab_id: tabsStore.current?.id,
      tab_name: tabsStore.current?.name,
      tags: snippetTags.value,
    }

    if (saveTabRef.value && tabsStore.current) {
      payload.tab_id = tabsStore.current.id
      payload.tab_name = tabsStore.current.name
    } else {
      payload.tab_id = null
      payload.tab_name = null
    }

    const result = snippetSchema.safeParse(payload)

    if (!result.success) {
      errorResponse.value = result.error.errors.map(e => e.message).join(', ')
      loading.value = false
      return
    }

    window.ipcRenderer.send('snippet-saved', JSON.parse(JSON.stringify(payload)))
  }

  const saveSnippetReply = (e: any) => {
    loading.value = false
    if (e.error) {
      errorResponse.value = e.error
    } else {
      emit('saved', e.data)
    }
  }

  onMounted(() => {
    window.ipcRenderer.on('snippet-saved.reply', saveSnippetReply)
  })

  onBeforeUnmount(() => {
    window.ipcRenderer.removeListener('snippet-saved.reply', saveSnippetReply)
  })
</script>

<template>
  <Container>
    <div class="mt-3 w-full mx-auto">
      <div class="mx-auto space-y-3">
        <div class="space-y-3">
          <div class="grid grid-cols-1 gap-4 items-center">
            <TextInput id="snippet_name" v-model="snippetName" placeholder="Snippet name" />
            <TagsInput
              id="tag_input"
              v-model="snippetTags"
              placeholder="Snippet tags (Enter to add, comma to separate)"
            />
            <div class="flex items-center justify-start gap-2">
              Save snippet to current tab:
              <SwitchInput
                v-model="saveTabRef"
              />
            </div>
          </div>

          <Divider />

          <h3>Preview</h3>

          <div class="h-[200px] flex w-auto">
            <Editor
              :id="`snippet-preview-${Date.now()}`"
              :key="`snippet-preview-${Date.now()}`"
              :editor-id="`snippet-preview-${Date.now()}`"
              language="output"
              :value="snippetCode"
              :readonly="true"
            />
          </div>

          <Divider />

          <div class="flex items-center justify-end">
            <PrimaryButton @click="saveSnippet" :disabled="loading">
              <ArrowPathIcon
                v-if="loading"
                :spin="true"
                class="w-4 h-4 cursor-pointer hover:text-primary-500 animate-spin mr-1"
              />
              Save snippet
            </PrimaryButton>
          </div>
        </div>

        <div class="mt-2">
          <span v-text="errorResponse" class="text-xs text-red-500"></span>
        </div>
      </div>
    </div>
  </Container>
</template>

<style scoped></style>
