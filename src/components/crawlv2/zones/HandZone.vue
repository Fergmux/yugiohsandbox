<template>
  <ZoneBase
    :name="name"
    :card="card"
    :location="location"
    :turn="turn"
    :current-player="currentPlayer"
    :my-player="myPlayer"
    class="bg-gray-300/25"
    @activate-effect="onActivateEffect"
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
  (e: 'activate-effect', card: GameCard, effectIndex: number): void
}>()

function onActivateEffect(card: GameCard, effectIndex: number) {
  emit('activate-effect', card, effectIndex)
}
</script>
