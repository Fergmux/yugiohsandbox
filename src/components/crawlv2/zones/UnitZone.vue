<template>
  <ZoneBase
    :name="name"
    :card="card"
    :location="location"
    :current-player="currentPlayer"
    :all-cards="allCards"
    class="aspect-square bg-amber-500/75"
    @activate-effect="emit('activate-effect', $event)"
  />
</template>

<script setup lang="ts">
import ZoneBase from './ZoneBase.vue'
import { type GameCard } from '@/types/cards'
import type { Location } from '@/types/crawlv2'

defineProps<{
  name: string
  card?: GameCard | null
  location: Location
  currentPlayer?: 'player1' | 'player2'
  allCards?: GameCard[]
}>()
const emit = defineEmits<{
  (e: 'activate-effect', card: GameCard): void
}>()
</script>
