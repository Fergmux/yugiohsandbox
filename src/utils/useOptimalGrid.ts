// useOptimalGrid.ts
import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'

export function useOptimalGrid(itemCount: Ref<number>) {
  const viewportWidth = ref(0)
  const viewportHeight = ref(0)

  // Update viewport dimensions
  const updateViewportDimensions = () => {
    viewportWidth.value = window.innerWidth
    viewportHeight.value = window.innerHeight
  }

  // Calculate grid dimensions
  const gridDimensions = computed(() => {
    const count = itemCount.value
    if (count === 0) return { columns: 0, rows: 0 }

    const imageArea = viewportWidth.value * viewportHeight.value * 0.5
    const areaPerCard = imageArea / count

    const width = Math.sqrt(areaPerCard * 0.67)
    const height = width * 0.67

    const columns = Math.floor(viewportWidth.value / width)
    const rows = Math.floor(viewportHeight.value / height)
    return { columns, rows }
  })

  // Generate CSS for the grid container
  const gridStyle = computed(() => {
    const { columns, rows } = gridDimensions.value

    return {
      'grid-template-columns': `repeat(${columns}, 1fr)`,
    } as const
  })

  // Set up event listeners
  onMounted(() => {
    updateViewportDimensions()
    window.addEventListener('resize', updateViewportDimensions)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateViewportDimensions)
  })

  return {
    gridStyle,
  }
}
