<template>
  <ZoneBase :name="name" :card="card" :location="location" class="aspect-2/3 bg-green-700/75" />
</template>

<script setup lang="ts">
import ZoneBase from './ZoneBase.vue'
import { type GameCard } from '@/types/cards'
import type { Location } from '@/types/crawlv2'

defineProps<{
  name: string
  card?: GameCard | null
  location: Location
}>()
</script>
