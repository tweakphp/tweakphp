import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSnippetStore = defineStore('snippet', () => {
  const showModal = ref<boolean>(false)
  const code = ref<string>('')

  const openModal = (snippetCode: string): void => {
    code.value = snippetCode
    showModal.value = true
    console.log(`Opening snippet modal with code: ${snippetCode}`)
  }
  const modalClosed = (): void => {
    showModal.value = false
    code.value = ''
    console.log('Snippet modal closed')
  }

  const getCode = (): string => {
    if (code.value) {
      return code.value
    }
    console.warn('No code available in snippet modal')
    return ''
  }

  return {
    openModal,
    modalClosed,
    getCode,
    showModal,
  }
})
