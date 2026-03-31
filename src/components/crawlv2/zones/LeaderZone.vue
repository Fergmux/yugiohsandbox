<template>
  <ZoneBase :name="name" :card="card" :id="id" class="aspect-2/3 bg-yellow-600/75" />
</template>

<script setup lang="ts">
import ZoneBase from './ZoneBase.vue'
import type { Card } from '@/types/crawlv2'

defineProps<{
  name: string
  card: Card
  id: string
}>()
</script>
