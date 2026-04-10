<template>
  <ZoneBase
    :name="name"
    :card="card"
    :location="location"
    :turn="turn"
    :current-player="currentPlayer"
    :my-player="myPlayer"
    class="aspect-2/3 bg-blue-700/75"
    @sacrifice="emit('sacrifice', $event)"
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
  turn?: number
  currentPlayer?: 'player1' | 'player2'
  myPlayer?: 'player1' | 'player2'
}>()
const emit = defineEmits<{
  (e: 'sacrifice', card: GameCard): void
}>()
</script>
