<template>
  <div class="relative flex h-screen w-screen items-center justify-center">
    <!-- Top HUD -->
    <div class="absolute top-3 right-0 left-0 z-10 flex items-center justify-between px-6">
      <div class="flex items-center gap-2 rounded bg-black/70 px-3 py-1 text-sm text-white">
        <span class="text-gray-300">Player 1</span>
        <span class="font-bold text-red-400">{{ gameState.player1HP }} LP</span>
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
        <span class="font-bold text-red-400">{{ gameState.player2HP }} LP</span>
        <span class="text-gray-300">Player 2</span>
      </div>
    </div>

    <!-- Target selection prompt -->
    <div
      v-if="targetPending"
      class="absolute top-14 left-1/2 z-20 -translate-x-1/2 rounded bg-amber-400 px-4 py-1.5 text-sm font-bold text-black shadow-lg"
    >
      Select a target ({{ selectedTargets.length }}/{{ targetPending.maxTargets }})
      <button @click="cancelSelection()" class="ml-3 text-red-700 hover:text-red-900">Cancel</button>
    </div>

    <div
      class="mx-auto grid w-[130vh] grid-cols-[2fr_2fr_3fr_3fr_3fr_2fr_2fr] grid-rows-[3fr_2fr_3fr_3fr_0.5fr_3fr_3fr_2fr_3fr] gap-x-[min(80px,3vh)] gap-y-2 bg-cover bg-center bg-no-repeat px-[min(15vw,30vh)] py-[5vh] select-none"
      :style="{ backgroundImage: `url(${playspaceImg})` }"
    >
      <FieldZone
        v-for="location in locations"
        class="col-span-1"
        :class="{
          'ring-2 ring-yellow-400': !targetPending && location.id === selectedCardLocation?.id,
          'cursor-crosshair ring-2 ring-red-500': isValidTarget(location),
          'ring-2 ring-orange-400': isSelectedTarget(location),
        }"
        :key="location.id"
        :name="location.name"
        :card="getCard(location)"
        :type="location.type"
        :location="location"
        :current-player="gameState.currentPlayer"
        @mousedown="selectCard(location)"
        @mouseup="moveCard(location)"
        @swap-stance="swapStance"
        @activate-effect="activateEffect"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import FieldZone from '@/components/crawlv2/zones/FieldZone.vue'
import { locations, type Location } from '@/types/crawlv2'
import playspaceImg from '@/assets/images/playspace.png'
import cardImg from '@/assets/images/cards/card.png'
import effectImg from '@/assets/images/cards/effect.png'
import trapImg from '@/assets/images/cards/trap.png'
import { type GameCard } from '@/types/cards'
import { createEffectResolver } from '@/composables/crawlv2/EffectResolver'
import { computed, ref, type Ref } from 'vue'
import { EventBus, Event } from '@/composables/crawlv2/EventBus'
import { useActivationPrompt } from '@/composables/crawlv2/useActivationPrompt'
import { useTargetSelector } from '@/composables/crawlv2/useTargetSelector'
import { registerBuffSystems } from '@/composables/crawlv2/BuffSystem'

const { ask } = useActivationPrompt()
const { pending, selectedTargets, toggleTarget, cancelSelection } = useTargetSelector()
const targetPending = computed(() => pending.value)

const selectedCard = ref<GameCard | null>(null)
const selectedCardLocation = computed<Location | null>(() => selectedCard.value?.location ?? null)

// ─── Turn state ─────────────────────────────────────────────────────────────

interface GameState {
  cards: GameCard[]
  turn: number
  currentPlayer: 'player1' | 'player2'
  player1HP: number
  player2HP: number
}

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

const selectCard = (location: Location | null) => {
  // Intercept clicks for target selection
  if (pending.value) {
    if (!location) return
    const card = getCard(location)
    if (card && pending.value.validTargets.some((t) => t.gameId === card.gameId)) {
      toggleTarget(card)
    }
    return
  }
  selectedCard.value = location ? getCard(location) : null
}

const moveCard = (location: Location) => {
  if (pending.value) return
  if (!selectedCard.value) return

  // Prevent moving cards whose owner does not match the current player
  if (selectedCard.value.owner !== gameState.value.currentPlayer) return

  effectResolver.moveCard(selectedCard.value, location, gameState.value.cards)
}

const swapStance = (card: GameCard) => {
  effectResolver.swapStance({ card })
}

const activateEffect = async (card: GameCard) => {
  await effectResolver.activateEffect(card, gameState.value.cards)
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

const gameState: Ref<GameState> = ref({
  turn: 1,
  currentPlayer: 'player1',
  player1HP: 40,
  player2HP: 40,
  cards: [
    {
      id: 1,
      gameId: '1',
      name: 'Warrior',
      image: cardImg,
      atk: 10,
      def: 10,
      cost: 1,
      type: 'unit',
      race: 'warrior',
      damage: 'physical',
      description: 'A strong guy',
      effect: 'He kills people',
      rarity: 'common',
      location: { id: 'deck1', type: 'deck', index: 1, player: 'player1', name: 'Deck' } as Location,
      owner: 'player1',
      buffs: {},
      debuffs: {},
      faceUp: false,
      defensePosition: false,
    },
    {
      id: 1,
      gameId: '2',
      name: 'Warrior',
      image: cardImg,
      atk: 10,
      def: 10,
      cost: 1,
      type: 'unit',
      race: 'warrior',
      damage: 'physical',
      description: 'A strong guy',
      effect: 'He kills people',
      rarity: 'common',
      location: { id: 'deck1', type: 'deck', index: 2, player: 'player1', name: 'Deck' } as Location,
      owner: 'player1',
      buffs: {},
      debuffs: {},
      faceUp: false,
      defensePosition: false,
    },
    {
      id: 3,
      gameId: '3',
      name: 'Dragon',
      image: cardImg,
      atk: 12,
      def: 8,
      cost: 2,
      type: 'unit',
      race: 'dragon',
      damage: 'void',
      description: 'A fire breathing dragon',
      effect: 'He kills people',
      rarity: 'rare',
      location: { id: 'deck2', type: 'deck', index: 3, player: 'player2', name: 'Deck' } as Location,
      owner: 'player2',
      buffs: {},
      debuffs: {},
      faceUp: false,
      defensePosition: false,
    },
    {
      id: 3,
      gameId: '4',
      name: 'Fire Dragon',
      image: cardImg,
      atk: 12,
      def: 8,
      cost: 2,
      type: 'unit',
      race: 'dragon',
      damage: 'fire',
      description: 'A fire breathing dragon',
      effect: "Adjacent dragon's attacks are treated as fire damage",
      rarity: 'rare',
      location: { id: 'deck2', type: 'deck', index: 4, player: 'player2', name: 'Deck' } as Location,
      owner: 'player2',
      buffs: {},
      debuffs: {},
      faceUp: false,
      defensePosition: false,
      effects: [
        {
          effect: 'damage_type',
          ongoing: true,
          options: {
            damageType: 'fire',
          },
          trigger: Event.UNIT_SUMMONED,
          target: [
            { comparitor: 'equals', key: 'race', value: 'dragon' },
            { combinator: 'and', comparitor: 'equals', key: 'location.type', value: 'unit' },
            { combinator: 'and', comparitor: 'equals', key: 'owner', value: 'player2' },
            { combinator: 'and', comparitor: 'equals', key: 'type', value: 'unit' },
            { combinator: 'and', comparitor: 'adjacent' },
          ],
        },
      ],
    },
    {
      id: 3,
      gameId: '8',
      name: 'Burn Dragon',
      image: cardImg,
      atk: 12,
      def: 8,
      cost: 2,
      type: 'unit',
      race: 'dragon',
      damage: 'fire',
      description: 'A fire breathing dragon',
      effect: "Once per turn you can apply 2x burn to an opponent's unit",
      rarity: 'rare',
      location: { id: 'deck2', type: 'deck', index: 5, player: 'player2', name: 'Deck' } as Location,
      owner: 'player2',
      buffs: {},
      debuffs: {},
      faceUp: false,
      defensePosition: false,
      effects: [
        {
          effect: 'debuff',
          eventName: Event.BURN_APPLIED,
          options: {
            debuff: 'burn',
            value: 2,
          },
          trigger: 'manual',
          persistent: true,
          optional: true,
          resetOnEvent: Event.TURN_START,
          uses: 1,
          activations: 0,
          target: [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { combinator: 'and', comparitor: 'equals', key: 'owner', value: 'player1' },
            { combinator: 'and', comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        },
      ],
    },
    {
      id: 3,
      gameId: '9',
      name: 'Cleanse Warrior',
      image: cardImg,
      atk: 7,
      def: 9,
      cost: 2,
      type: 'unit',
      race: 'warrior',
      damage: 'psychic',
      description: '',
      effect: 'Once per turn, you can apply 1x Cleanse to this card',
      rarity: 'rare',
      location: { id: 'deck1', type: 'deck', index: 5, player: 'player1', name: 'Deck' } as Location,
      owner: 'player1',
      buffs: {},
      debuffs: {},
      faceUp: false,
      defensePosition: false,
      effects: [
        {
          effect: 'buff',
          eventName: Event.CLEANSE_APPLIED,
          options: {
            buff: 'cleanse',
            value: 1,
          },
          resetOnEvent: Event.TURN_START,
          uses: 1,
          activations: 0,
          trigger: 'manual',
          persistent: true,
          optional: false,
          target: [{ comparitor: 'itself' }],
        },
      ],
    },
    {
      id: 2,
      gameId: '5',
      name: 'Effect',
      image: effectImg,
      cost: 0,
      type: 'effect',
      description: 'If you control a Warrior unit, you can add one spent unit to your hand.',
      location: { id: 'deck1', type: 'deck', index: 3, player: 'player1', name: 'Deck' } as Location,
      owner: 'player1',
      buffs: {},
      debuffs: {},
      faceUp: false,
      defensePosition: false,
    },
    {
      id: 2,
      gameId: '6',
      name: 'Effect',
      image: effectImg,
      cost: 0,
      type: 'effect',
      description: 'If you control a Dragon unit, you can add one spent unit to your hand.',
      location: { id: 'deck2', type: 'deck', index: 2, player: 'player2', name: 'Deck' } as Location,
      owner: 'player2',
      buffs: {},
      debuffs: {},
      faceUp: false,
      defensePosition: false,
      effects: [
        {
          effect: 'add_to_hand',
          conditions: [
            {
              test: 'has_card',
              checks: [
                { comparitor: 'equals', key: 'race', value: 'dragon' },
                { combinator: 'and', comparitor: 'equals', key: 'location.type', value: 'unit' },
                { combinator: 'and', comparitor: 'equals', key: 'owner', value: 'player2' },
              ],
            },
          ],
          target: [
            { comparitor: 'equals', key: 'location.type', value: 'spent' },
            { combinator: 'and', comparitor: 'equals', key: 'owner', value: 'player2' },
            { combinator: 'and', comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        },
      ],
    },
    {
      id: 3,
      gameId: '7',
      name: 'Trap',
      image: trapImg,
      cost: 0,
      type: 'trap',
      description: 'Negate an attack',
      location: { id: 'deck1', type: 'deck', index: 4, player: 'player1', name: 'Deck' } as Location,
      owner: 'player1',
      buffs: {},
      debuffs: {},
      faceUp: false,
      defensePosition: false,
      effects: [
        { trigger: Event.TARGETED_ATTACK, effect: 'negate_attack', optional: true, eventName: Event.TRAP_ACTIVATED },
      ],
    },
  ],
})

// Register buff/debuff systems (burn, cleanse) after gameState is defined
registerBuffSystems(() => gameState.value.cards)

// Create effect resolver with all dependencies
const effectResolver = createEffectResolver({
  getCard,
  selectCard: (card) => {
    selectedCard.value = card
  },
  ask,
  getCurrentPlayer: () => gameState.value.currentPlayer,
  gameState: gameState.value,
})
</script>

<style scoped></style>
