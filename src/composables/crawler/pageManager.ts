import { computed, ref, watch } from 'vue'

import { createSharedComposable } from '@vueuse/core'

import { useCrawlManager } from './crawlManager'

export const usePageManager = createSharedComposable(() => {
  const { updatePage, setBothPages, crawl, player } = useCrawlManager()

  const pages = ref<string[]>(['newGame', 'deckSelection', 'playSpace', 'rewards', 'endScreen'])
  const currentPageIndex = ref<number | null>(0)
  const currentPage = computed(() => pages.value[currentPageIndex.value ?? 0])
  const lockedPage = ref<number | null>(null)

  const isWaiting = computed(() => {
    if (!player.value) return false
    return crawl.value[player.value].page !== currentPageIndex.value
  })

  // Sync: navigate only when both players agree on the same page.
  // For spectators, follow the minimum (most conservative) page.
  // Skip updates when a page transition is locked (setBothPages in flight).
  watch(
    [() => crawl.value.player1.page, () => crawl.value.player2.page],
    ([p1, p2]) => {
      if (lockedPage.value !== null) return
      if (p1 === p2) {
        currentPageIndex.value = p1
      } else if (!player.value) {
        currentPageIndex.value = Math.min(p1, p2)
      }
    },
  )

  const getNextPage = (current: number | null): number => {
    switch (current) {
      case 0: return 1
      case 1: return 2
      case 2: return 3
      case 3: return 2
      default: return 0
    }
  }

  const next = async () => {
    const targetPage = getNextPage(currentPageIndex.value)
    await updatePage(targetPage)
  }

  // Moves both players to the target page atomically.
  // Locks the sync watcher so Firestore snapshots with stale data
  // cannot revert the optimistic page update.
  const moveBothToPage = async (page: number) => {
    currentPageIndex.value = page
    lockedPage.value = page
    try {
      await setBothPages(page)
    } finally {
      lockedPage.value = null
    }
  }

  const endCrawl = async () => {
    await moveBothToPage(4)
  }

  return {
    pages,
    currentPage,
    currentPageIndex,
    isWaiting,
    next,
    moveBothToPage,
    endCrawl,
  }
})
