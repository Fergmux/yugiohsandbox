import { onBeforeUnmount, onMounted, ref } from 'vue'

type KeyShortcut = {
  key: string
  handler: () => void
}

export function useFieldShortcuts() {
  const isShiftHeld = ref(false)
  const keyShortcuts: KeyShortcut[] = []

  const registerShortcut = (key: string, handler: () => void) => {
    keyShortcuts.push({ key, handler })
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Shift') isShiftHeld.value = true
  }

  const isEditableTarget = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') isShiftHeld.value = false

    if (isEditableTarget(e)) return

    const shortcut = keyShortcuts.find((s) => s.key === e.key)
    if (shortcut) shortcut.handler()
  }

  const handleBlur = () => {
    isShiftHeld.value = false
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('blur', handleBlur)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown, true)
    window.removeEventListener('keyup', handleKeyUp, true)
    window.removeEventListener('blur', handleBlur)
  })

  return { isShiftHeld, registerShortcut }
}
