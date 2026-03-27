<script setup lang="ts">
import { usePageManager } from '@/composables/crawler/pageManager'

const { next } = usePageManager()
</script>

<template>
  <div>
    <h1>GameRewards</h1>
    <button @click="next">Next</button>
  </div>
</template>
