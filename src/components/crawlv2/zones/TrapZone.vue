<template>
  <ZoneBase
    :name="name"
    :card="card"
    :location="location"
    :current-player="currentPlayer"
    :my-player="myPlayer"
    rotate
    class="bg-red-700/75 text-white"
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
  currentPlayer?: 'player1' | 'player2'
  myPlayer?: 'player1' | 'player2'
}>()
const emit = defineEmits<{
  (e: 'sacrifice', card: GameCard): void
}>()
</script>
