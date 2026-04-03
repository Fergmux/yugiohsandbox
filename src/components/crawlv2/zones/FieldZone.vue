<template>
  <component
    :is="component"
    :name="name"
    :card="card"
    :location="location"
    :current-player="currentPlayer"
    :all-cards="allCards"
    @activate-effect="onActivateEffect"
  />
</template>

<script setup lang="ts">
import type { Location, ZoneType } from '@/types/crawlv2'
import { type GameCard } from '@/types/cards'
import HandZone from './HandZone.vue'
import PowerZone from './PowerZone.vue'
import UnitZone from './UnitZone.vue'
import LeaderZone from './LeaderZone.vue'
import TrapZone from './TrapZone.vue'
import EmptyZone from './EmptyZone.vue'
import DeckZone from './DeckZone.vue'
import DeadZone from './DeadZone.vue'
import SpentZone from './SpentZone.vue'
import { computed } from 'vue'

const props = defineProps<{
  name: string | null
  card?: GameCard | null
  location: Location
  type: ZoneType
  currentPlayer?: 'player1' | 'player2'
  allCards?: GameCard[]
}>()
const emit = defineEmits<{
  (e: 'activate-effect', card: GameCard, effectIndex: number): void
}>()

function onActivateEffect(card: GameCard, effectIndex: number) {
  emit('activate-effect', card, effectIndex)
}

const component = computed(() => {
  switch (props.type) {
    case 'hand':
      return HandZone
    case 'power':
      return PowerZone
    case 'unit':
      return UnitZone
    case 'leader':
      return LeaderZone
    case 'trap':
      return TrapZone
    case 'empty':
      return EmptyZone
    case 'deck':
      return DeckZone
    case 'spent':
      return SpentZone
    case 'dead':
      return DeadZone
    default:
      return EmptyZone
  }
})
</script>
