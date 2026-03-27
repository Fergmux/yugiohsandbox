<script setup lang="ts">
import { useCrawlManager } from '@/composables/crawler/crawlManager'
import PlaySpace from '@/views/PlaySpace.vue'

const { player } = useCrawlManager()
</script>

<template>
  <div>
    <h1>PlaySpace</h1>
    <play-space :crawl-player="player" />
  </div>
</template>
