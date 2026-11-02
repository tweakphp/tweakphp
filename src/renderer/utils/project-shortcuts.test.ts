import { effectScope, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useModalActivity } from '../composables/useModalActivity'
import { handleProjectShortcut } from './project-shortcuts'

describe('project shortcuts', () => {
  it('prevents shortcuts while any modal is open and restores them afterward', () => {
    const execute = vi.fn()
    const archive = vi.fn()
    const event = (key: string) => ({ key, ctrlKey: true, metaKey: false, shiftKey: false, preventDefault: vi.fn() })
    const scope = effectScope()
    const open = ref(true)
    scope.run(() => useModalActivity(open, () => true))
    const run = event('r')
    const close = event('w')
    handleProjectShortcut(run as unknown as KeyboardEvent, execute, archive)
    handleProjectShortcut(close as unknown as KeyboardEvent, execute, archive)
    expect(run.preventDefault).toHaveBeenCalled()
    expect(close.preventDefault).toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
    expect(archive).not.toHaveBeenCalled()
    open.value = false
    handleProjectShortcut(run as unknown as KeyboardEvent, execute, archive)
    handleProjectShortcut(close as unknown as KeyboardEvent, execute, archive)
    expect(execute).toHaveBeenCalledOnce()
    expect(archive).toHaveBeenCalledOnce()
    scope.stop()
  })
})
