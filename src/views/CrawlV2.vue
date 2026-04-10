<template>
  <div class="relative flex h-screen w-screen items-center justify-center">
    <!-- Top HUD -->
    <div class="absolute top-3 right-0 left-0 z-10 flex items-center justify-between px-6">
      <div class="flex items-center gap-2 rounded bg-black/70 px-3 py-1 text-sm text-white">
        <span class="text-gray-300">Player 1</span>
        <span class="font-bold text-red-400">{{ gameState.player1HP }} LP</span>
        <span class="font-bold text-blue-400">{{ gameState.player1AP }} AP</span>
      </div>

      <div class="flex items-center gap-3">
        <div class="rounded bg-black/70 px-3 py-1 text-sm text-white">
          Turn {{ gameState.turn }} &mdash;
          <span class="font-bold">{{ gameState.currentPlayer === 'player1' ? 'Player 1' : 'Player 2' }}'s turn</span>
        </div>
        <button
          @click="endTurn"
          class="rounded bg-emerald-700 px-3 py-1 text-sm font-bold text-white hover:bg-emerald-600 active:bg-emerald-800"
        >
          End Turn
        </button>
      </div>

      <div class="flex items-center gap-2 rounded bg-black/70 px-3 py-1 text-sm text-white">
        <span class="font-bold text-blue-400">{{ gameState.player2AP }} AP</span>
        <span class="font-bold text-red-400">{{ gameState.player2HP }} LP</span>
        <span class="text-gray-300">Player 2</span>
      </div>
    </div>

    <!-- Prompts -->
    <div
      v-if="targetPending"
      class="absolute top-14 left-1/2 z-20 -translate-x-1/2 rounded bg-amber-400 px-4 py-1.5 text-sm font-bold text-black shadow-lg"
    >
      Select a target ({{ selectedTargets.length }}/{{ targetPending.maxTargets }})
      <button v-if="targetPending.optional" @click="cancelSelection()" class="ml-3 text-red-700 hover:text-red-900">
        Cancel
      </button>
    </div>
    <div
      v-else-if="pendingZone"
      class="absolute top-14 left-1/2 z-20 -translate-x-1/2 rounded bg-emerald-400 px-4 py-1.5 text-sm font-bold text-black shadow-lg"
    >
      Select a zone to summon {{ pendingZone.label ?? 'card' }}
      <button @click="cancelZoneSelection()" class="ml-3 text-red-700 hover:text-red-900">Cancel</button>
    </div>

    <CardPickerModal />

    <div
      class="mx-auto grid w-[130vh] grid-cols-[2fr_2fr_3fr_3fr_3fr_2fr_2fr] grid-rows-[3fr_2fr_3fr_3fr_0.5fr_3fr_3fr_2fr_3fr] gap-x-[min(80px,3vh)] gap-y-2 bg-cover bg-center bg-no-repeat px-[min(15vw,30vh)] py-[5vh] select-none"
      :style="{ backgroundImage: `url(${playspaceImg})` }"
    >
      <FieldZone
        v-for="location in locations"
        class="col-span-1"
        :class="{
          'cursor-crosshair ring-2 ring-red-500': isValidTarget(location),
          'ring-2 ring-orange-400': isSelectedTarget(location),
          'cursor-pointer ring-2 ring-emerald-400': isValidSummonTarget(location),
        }"
        :key="location.id"
        :name="location.name"
        :card="getCard(location)"
        :type="location.type"
        :location="location"
        :current-player="gameState.currentPlayer"
        :all-cards="gameState.cards"
        @click="handleZoneClick(location)"
        @mouseenter="handleZoneHover(location)"
        @mouseleave="handleZoneHover(null)"
        @activate-effect="activateEffect"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import FieldZone from '@/components/crawlv2/zones/FieldZone.vue'
import CardPickerModal from '@/components/crawlv2/CardPickerModal.vue'
import { locations, type Location, type GameState } from '@/types/crawlv2'
import playspaceImg from '@/assets/images/playspace.png'
import { type GameCard } from '@/types/cards'
import { computed, onMounted, ref, type Ref } from 'vue'
import { EventBus, Event } from '@/composables/crawlv2/EventBus'
import { useActivationPrompt } from '@/composables/crawlv2/useActivationPrompt'
import { useTargetSelector } from '@/composables/crawlv2/useTargetSelector'
import { registerBuffSystems } from '@/composables/crawlv2/BuffSystem'
import { defaultGameState } from '@/types/defaultGameState'
import { registerEffectResolver } from '@/composables/crawlv2/EffectResolver'
import { registerGameState } from '@/composables/crawlv2/GameState'

const { ask } = useActivationPrompt()
const {
  pending,
  selectedTargets,
  toggleTarget,
  cancelSelection,
  pendingZone,
  pickZone,
  cancelZoneSelection,
  setHoveredTarget,
} = useTargetSelector()
const targetPending = computed(() => pending.value)

const selectedCard = ref<GameCard | null>(null)

// ─── Card helpers ────────────────────────────────────────────────────────────

const getCard = (location: Location): GameCard | null => {
  if (!location) return null
  return gameState.value.cards.find((card) => card.location.id === location.id) ?? null
}

const isValidTarget = (location: Location): boolean => {
  if (!pending.value) return false
  const card = getCard(location)
  return card ? pending.value.validTargets.some((t) => t.gameId === card.gameId) : false
}

const isSelectedTarget = (location: Location): boolean => {
  if (!selectedTargets.value.length) return false
  const card = getCard(location)
  return card ? selectedTargets.value.some((t) => t.gameId === card.gameId) : false
}

const isValidSummonTarget = (location: Location): boolean =>
  pendingZone.value?.validZones.some((z) => z.id === location.id) ?? false

const handleZoneClick = (location: Location) => {
  if (pending.value) {
    const card = getCard(location)
    if (card && pending.value.validTargets.some((t) => t.gameId === card.gameId)) {
      toggleTarget(card)
    }
    return
  }
  if (pendingZone.value) {
    if (isValidSummonTarget(location)) pickZone(location)
    else cancelZoneSelection()
  }
}

const handleZoneHover = (location: Location | null) => {
  if (!pending.value || !location) {
    setHoveredTarget(null)
    return
  }
  const card = getCard(location)
  if (card && pending.value.validTargets.some((t) => t.gameId === card.gameId)) {
    setHoveredTarget(card)
  } else {
    setHoveredTarget(null)
  }
}

const activateEffect = async (card: GameCard, effectIndex: number) => {
  await effectResolver.activateEffect(card, card.effects?.[effectIndex])
}

// ─── Turn management ──────────────────────────────────────────────────────────

const endTurn = async () => {
  const current = gameState.value.currentPlayer
  const next: 'player1' | 'player2' = current === 'player1' ? 'player2' : 'player1'

  await EventBus.emit(Event.TURN_END, 'game', {
    currentPlayer: current,
    cards: gameState.value.cards,
  })

  if (current === 'player2') gameState.value.turn++
  gameState.value.currentPlayer = next

  await EventBus.emit(Event.TURN_START, 'game', {
    currentPlayer: next,
    cards: gameState.value.cards,
  })
}

// ─── Game state ──────────────────────────────────────────────────────────────

const gameState: Ref<GameState> = ref(defaultGameState)

// Register global game state, buff systems, and effect resolver
registerGameState(gameState.value)
registerBuffSystems()

const effectResolver = registerEffectResolver({
  selectCard: (card) => {
    selectedCard.value = card
  },
  ask,
})

// Emit game start event on mount
onMounted(async () => {
  await EventBus.emit(Event.GAME_START, 'game', {
    cards: gameState.value.cards,
  })
  await EventBus.emit(Event.TURN_START, 'game:ap', {
    currentPlayer: gameState.value.currentPlayer,
    cards: gameState.value.cards,
  })
})
</script>

<style scoped></style>
