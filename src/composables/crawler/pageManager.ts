import { computed, ref } from 'vue'

import { createSharedComposable } from '@vueuse/core'

import { useCrawlManager } from './crawlManager'

export const usePageManager = createSharedComposable(() => {
  const { updatePage } = useCrawlManager()

  const pages = ref<string[]>(['newGame', 'deckSelection', 'playSpace', 'rewards', 'endScreen'])
  const currentPageIndex = ref<number | null>(0)
  const currentPage = computed(() => pages.value[currentPageIndex.value ?? 0])

  const next = async () => {
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
    await updatePage(currentPageIndex.value ?? 0)
  }

  const endCrawl = () => {
    currentPageIndex.value = 4
    updatePage(currentPageIndex.value ?? 0)
  }

  return {
    pages,
    currentPage,
    currentPageIndex,
    next,
    endCrawl,
  }
})
