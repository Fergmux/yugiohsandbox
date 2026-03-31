<template>
  <div
    :style="{ backgroundImage: `url(${card.image})` }"
    class="flex aspect-2/3 h-full items-center justify-center rounded-md border-2 border-gray-300 bg-contain bg-center bg-no-repeat text-xl font-bold text-white"
  >
    {{ card.name }}
  </div>
</template>

<script setup lang="ts">
import type { Card } from '@/types/crawlv2'

defineProps<{
  card: Card
}>()
</script>
