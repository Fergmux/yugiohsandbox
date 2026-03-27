import { computed, ref } from 'vue'

import { createSharedComposable } from '@vueuse/core'

export const usePageManager = createSharedComposable(() => {
  const pages = ref<string[]>(['newGame', 'deckSelection', 'playSpace', 'rewards'])
  const currentPageIndex = ref<number | null>(0)
  const currentPage = computed(() => pages.value[currentPageIndex.value ?? 0])

  const next = () => {
    switch (currentPageIndex.value) {
      case 0:
        currentPageIndex.value = 1
        break
      case 1:
        currentPageIndex.value = 2
        break
      case 2:
        currentPageIndex.value = 3
        break
      case 3:
        currentPageIndex.value = 2
        break
      default:
        currentPageIndex.value = 0
        break
    }
  }

  return {
    pages,
    currentPage,
    currentPageIndex,
    next,
  }
})
