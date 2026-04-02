<template>
  <div class="bg-opacity-50 relative flex items-center justify-center rounded-md border-2 border-gray-400">
    <template v-if="card">
      <div v-if="rotate" class="relative w-full overflow-hidden" style="aspect-ratio: 3/2">
        <CardBase
          :card="card"
          :current-player="currentPlayer"
          :all-cards="allCards"
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90"
          style="height: 150%; width: full"
          @swap-stance="emit('swap-stance', $event)"
          @activate-effect="emit('activate-effect', $event)"
        />
      </div>
      <CardBase
        v-else
        :card="card"
        :current-player="currentPlayer"
        :all-cards="allCards"
        @swap-stance="emit('swap-stance', $event)"
        @activate-effect="emit('activate-effect', $event)"
      />

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
import CardBase from '@/components/crawlv2/CardBase.vue'
import { type GameCard } from '@/types/cards'
import type { Location } from '@/types/crawlv2'
import { useActivationPrompt } from '@/composables/crawlv2/useActivationPrompt'

defineProps<{
  name: string
  card?: GameCard | null
  location: Location
  rotate?: boolean
  currentPlayer?: 'player1' | 'player2'
  allCards?: GameCard[]
}>()
const emit = defineEmits<{
  (e: 'swap-stance', card: GameCard): void
  (e: 'activate-effect', card: GameCard): void
}>()

const { pending, respond } = useActivationPrompt()
</script>

<style scoped></style>
