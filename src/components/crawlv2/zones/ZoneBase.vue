<template>
  <div class="group/zone bg-opacity-50 relative flex items-center justify-center rounded-md border-2 border-gray-400">
    <template v-if="card">
      <div v-if="rotate" class="relative w-full overflow-hidden" style="aspect-ratio: 3/2">
        <CardBase
          :card="card"
          :turn="turn"
          :current-player="currentPlayer"
          :my-player="myPlayer"
          :all-cards="allCards"
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90"
          style="height: 150%; width: full"
          @activate-effect="onActivateEffect"
        />
      </div>
      <CardBase
        v-else
        :card="card"
        :turn="turn"
        :current-player="currentPlayer"
        :my-player="myPlayer"
        :all-cards="allCards"
        @activate-effect="onActivateEffect"
      />

      <!-- Description tooltip: show your own cards freely, but only reveal opponent field cards when face-up. -->
      <div
        v-if="card.description && showTooltip"
        class="pointer-events-none invisible absolute -top-2 left-1/2 z-50 w-max max-w-[200px] -translate-x-1/2 -translate-y-full rounded bg-black/90 px-2 py-1.5 text-[9px] leading-tight font-normal text-white group-hover/zone:visible"
      >
        {{ card.description }}
      </div>

      <div
        v-if="pending?.card.gameId === card.gameId"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-md bg-black/60"
        @mousedown.stop
        @mouseup.stop
      >
        <button
          class="w-4/5 rounded bg-green-500 px-1 py-0.5 text-xs font-bold text-white hover:bg-green-400"
          @click="respond(true)"
        >
          Activate
        </button>
        <button
          class="w-4/5 rounded bg-gray-500 px-1 py-0.5 text-xs font-bold text-white hover:bg-gray-400"
          @click="respond(false)"
        >
          Cancel
        </button>
      </div>
    </template>
    <div v-else class="text-center">
      <p class="my-auto text-sm font-bold">{{ name }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CardBase from '@/components/crawlv2/CardBase.vue'
import { type GameCard } from '@/types/cards'
import type { Location } from '@/types/crawlv2'
import { useActivationPrompt } from '@/composables/crawlv2/useActivationPrompt'

const TOOLTIP_ZONES = new Set(['hand', 'power', 'unit', 'trap'])
const OPPONENT_FIELD_ZONES = new Set(['power', 'unit', 'trap'])

const props = defineProps<{
  name: string
  card?: GameCard | null
  location: Location
  rotate?: boolean
  turn?: number
  currentPlayer?: 'player1' | 'player2'
  myPlayer?: 'player1' | 'player2'
  allCards?: GameCard[]
}>()
const emit = defineEmits<{
  (e: 'activate-effect', card: GameCard, effectIndex: number): void
}>()

const { pending, respond } = useActivationPrompt()

const isOwnCard = computed(() => {
  if (!props.card) return false
  if (!props.myPlayer) return true
  return props.card.owner === props.myPlayer || props.card.location?.player === props.myPlayer
})

const showTooltip = computed(() => {
  if (!props.card) return false

  const zoneType = props.card.location?.type
  if (!TOOLTIP_ZONES.has(zoneType)) return false

  if (isOwnCard.value) return true

  return OPPONENT_FIELD_ZONES.has(zoneType) && props.card.faceUp === true
})

function onActivateEffect(card: GameCard, effectIndex: number) {
  emit('activate-effect', card, effectIndex)
}
</script>

<style scoped></style>
