<template>
  <div v-if="isWaiting" class="mt-20 text-center">
    <p class="text-xl text-gray-400">Waiting on other player...</p>
  </div>
  <router-view v-else />
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'

import { useRoute } from 'vue-router'

import { useCrawlManager } from '@/composables/crawler/crawlManager'
import { usePageManager } from '@/composables/crawler/pageManager'
import router from '@/router'

const route = useRoute()
const { currentPageIndex, currentPage, isWaiting } = usePageManager()
const { leaveGame } = useCrawlManager()

const resetCrawl = () => {
  currentPageIndex.value = 0
  leaveGame()
}

onMounted(resetCrawl)

// Re-navigating to /crawler while already mounted doesn't trigger onMounted,
// so watch the route to reset state when the user clicks the nav link.
watch(
  () => route.path,
  (newPath) => {
    if (newPath === '/crawler') {
      resetCrawl()
    }
  },
)

watch(
  currentPage,
  (newPage) => {
    router.push({ name: newPage })
  },
  { immediate: true },
)
</script>
