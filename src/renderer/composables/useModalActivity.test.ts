import { effectScope, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { hasActiveModal, useModalActivity } from './useModalActivity'

describe('modal activity', () => {
  it('tracks nested dialogs and cleans up on disposal', () => {
    const parent = effectScope()
    const child = effectScope()
    const parentOpen = ref(false)
    const childOpen = ref(false)
    const modal = ref(true)
    parent.run(() => useModalActivity(parentOpen, () => modal.value))
    child.run(() => useModalActivity(childOpen, () => true))

    expect(hasActiveModal()).toBe(false)
    parentOpen.value = true
    childOpen.value = true
    parentOpen.value = false
    expect(hasActiveModal()).toBe(true)
    child.stop()
    expect(hasActiveModal()).toBe(false)
    parentOpen.value = true
    modal.value = false
    expect(hasActiveModal()).toBe(false)
    modal.value = true
    expect(hasActiveModal()).toBe(true)
    parent.stop()
    expect(hasActiveModal()).toBe(false)
  })
})
