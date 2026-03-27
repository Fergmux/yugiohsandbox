<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'

import { useCrawlManager } from '@/composables/crawler/crawlManager'
import { usePageManager } from '@/composables/crawler/pageManager'
import router from '@/router'

const { currentPageIndex, currentPage } = usePageManager()
const { leaveGame } = useCrawlManager()

onMounted(() => {
  currentPageIndex.value = 0
  leaveGame()
})

watch(
  currentPage,
  (newPage) => {
    router.push({ name: newPage })
    console.log(newPage)
  },
  { immediate: true },
)
</script>
