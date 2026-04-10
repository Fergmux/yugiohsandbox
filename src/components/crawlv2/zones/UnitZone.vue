<template>
  <ZoneBase
    :name="name"
    :card="card"
    :location="location"
    :current-player="currentPlayer"
    :my-player="myPlayer"
    :all-cards="allCards"
    class="aspect-square bg-amber-500/75"
    @activate-effect="onActivateEffect"
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
  allCards?: GameCard[]
}>()
const emit = defineEmits<{
  (e: 'activate-effect', card: GameCard, effectIndex: number): void
  (e: 'sacrifice', card: GameCard): void
}>()

function onActivateEffect(card: GameCard, effectIndex: number) {
  emit('activate-effect', card, effectIndex)
}
</script>
