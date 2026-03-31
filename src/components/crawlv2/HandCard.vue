<template>
  <CardBase :card="card" />
</template>

<script setup lang="ts">
import CardBase from './CardBase.vue'
import type { Card } from '@/types/crawlv2'

defineProps<{
  card: Card
}>()
</script>
