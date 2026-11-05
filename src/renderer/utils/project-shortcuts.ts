import { hasActiveModal } from '../composables/useModalActivity'

export const handleProjectShortcut = (event: KeyboardEvent, execute: () => void, archive: () => void) => {
  if ((!event.metaKey && !event.ctrlKey) || event.shiftKey || (event.key !== 'r' && event.key !== 'w')) return
  event.preventDefault()
  if (hasActiveModal()) return
  if (event.key === 'r') execute()
  else archive()
}
