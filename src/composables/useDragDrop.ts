import { onBeforeUnmount, ref, type Ref } from 'vue'

import type { BoardSide, YugiohCard } from '@/types/yugiohCard'

export interface DragData {
  card: YugiohCard
  sourceLocation: keyof BoardSide
  sourceIndex: number
  imageUrl: string
}

export interface DropZone {
  location: keyof BoardSide
  index?: number
}

const DRAG_THRESHOLD = 5

export function useDragDrop(onDrop: (drag: DragData, drop: DropZone) => void) {
  const dragging: Ref<DragData | null> = ref(null)
  const dragX = ref(0)
  const dragY = ref(0)
  const hoverZone: Ref<DropZone | null> = ref(null)
  const didDrag = ref(false)

  let startX = 0
  let startY = 0
  let pendingDrag: DragData | null = null
  let isDragging = false

  const findDropZone = (x: number, y: number): DropZone | null => {
    const elements = document.elementsFromPoint(x, y)
    for (const el of elements) {
      const zone = (el as HTMLElement).closest('[data-drop-zone]') as HTMLElement | null
      if (zone) {
        const location = zone.dataset.dropZone as keyof BoardSide
        const indexStr = zone.dataset.dropIndex
        const index = indexStr != null ? Number(indexStr) : undefined
        return { location, index }
      }
    }
    return null
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!pendingDrag && !isDragging) return

    const dx = e.clientX - startX
    const dy = e.clientY - startY

    if (!isDragging && Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
      isDragging = true
      didDrag.value = true
      dragging.value = pendingDrag
    }

    if (isDragging) {
      dragX.value = e.clientX
      dragY.value = e.clientY
      hoverZone.value = findDropZone(e.clientX, e.clientY)
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)

    if (isDragging && dragging.value) {
      const zone = findDropZone(e.clientX, e.clientY)
      if (zone) {
        onDrop(dragging.value, zone)
      }
    }

    isDragging = false
    pendingDrag = null
    dragging.value = null
    hoverZone.value = null

    requestAnimationFrame(() => {
      didDrag.value = false
    })
  }

  const startDrag = (data: DragData, event: PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    pendingDrag = data
    didDrag.value = false
    startX = event.clientX
    startY = event.clientY
    dragX.value = event.clientX
    dragY.value = event.clientY

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  })

  return {
    dragging,
    dragX,
    dragY,
    hoverZone,
    didDrag,
    startDrag,
  }
}
