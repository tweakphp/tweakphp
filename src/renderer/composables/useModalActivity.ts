import { onScopeDispose, watch, type Ref } from 'vue'

const activeModals = new Set<symbol>()

export const hasActiveModal = () => activeModals.size > 0

// Each mounted modal owns a token, so nested dialogs and unmounts cannot
// accidentally clear another dialog's active state.
export const useModalActivity = (open: Ref<boolean>, modal: () => boolean) => {
  const token = Symbol('modal')
  watch(
    () => open.value && modal(),
    active => {
      if (active) activeModals.add(token)
      else activeModals.delete(token)
    },
    { immediate: true, flush: 'sync' }
  )
  onScopeDispose(() => activeModals.delete(token))
}
