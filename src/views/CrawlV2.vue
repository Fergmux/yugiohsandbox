<template>
  <div class="flex h-screen w-screen items-center justify-center">
    <div
      class="mx-auto grid w-[130vh] grid-cols-[2fr_2fr_3fr_3fr_3fr_2fr_2fr] grid-rows-[3fr_2fr_3fr_3fr_0.5fr_3fr_3fr_2fr_3fr] gap-x-[min(80px,3vh)] gap-y-2 bg-cover bg-center bg-no-repeat px-[min(15vw,30vh)] py-[5vh] select-none"
      :style="{ backgroundImage: `url(${playspaceImg})` }"
    >
      <FieldZone
        v-for="location in locations"
        class="col-span-1"
        :class="{
          'ring-2 ring-yellow-400': location.id === selectedCardLocation?.id,
        }"
        :key="location.id"
        :name="location.name"
        :card="getCard(location)"
        :type="location.type"
        :location="location"
        @mousedown="selectCard(location)"
        @mouseup="moveCard(location)"
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
import { effectResolver } from '@/composables/crawlv2/EffectResolver'
import { computed, ref, type Ref } from 'vue'
import { EventBus, Event } from '@/composables/crawlv2/EventBus'
import { effectHandlers } from '@/composables/crawlv2/EffectHandlers'
import { useActivationPrompt } from '@/composables/crawlv2/useActivationPrompt'

const { ask } = useActivationPrompt()

const selectedCard = ref<GameCard | null>(null)
const selectedCardLocation = computed<Location | null>(() => selectedCard.value?.location ?? null)

const registerEffects = (card: GameCard) => {
  for (const effect of card.effects ?? []) {
    const handler = effectHandlers[effect.effect]
    if (handler) {
      EventBus.on(effect.trigger as Event, card.gameId, async (_e, _id, data, ctx) => {
        const activate = await ask(card)
        if (!activate) return
        EventBus.emit(Event.TRAP_ACTIVATED, card.gameId, { card })
        handler(data, ctx, card)
        EventBus.off(effect.trigger as Event, card.gameId)
      })
    }
  }
}

const getCard = (location: Location): GameCard | null => {
  if (!location) return null
  return gameState.value.cards.find((card) => card.location.id === location.id) ?? null
}

const selectCard = (location: Location | null) => {
  selectedCard.value = location ? getCard(location) : null
}

const playCard = async (location: Location) => {
  if (!selectedCard.value) return
  const card = selectedCard.value

  card.location = location
  selectCard(null)

  switch (card.type) {
    case 'unit':
      EventBus.emit(Event.UNIT_SUMMONED, card.gameId, { card })
      break
    case 'effect': {
      const { cancelled } = await EventBus.emit(Event.TARGETED_EFFECT, card.gameId, { card })
      if (!cancelled) effectResolver.executeCardEffects(card, gameState.value.cards)
      break
    }
    case 'trap':
      registerEffects(card)
      EventBus.emit(Event.TRAP_SET, card.gameId, { card })
      break
    case 'power':
      EventBus.emit(Event.POWER_PLAYED, card.gameId, { card })
      break

    default:
  }
}

const moveCard = (location: Location) => {
  if (!selectedCard.value) return

  const cardAtLocation = getCard(location)
  if (['unit', 'power', 'trap'].includes(location.type) && !cardAtLocation) {
    playCard(location)
    return
  }

  if (
    cardAtLocation &&
    cardAtLocation.location.type === 'unit' &&
    selectedCard.value?.location.type === 'unit' &&
    cardAtLocation.gameId !== selectedCard.value?.gameId
  ) {
    effectResolver.resolve<'damage'>({
      effect: 'damage',
      options: {
        target: cardAtLocation,
        source: selectedCard.value,
      },
    })
    selectCard(null)
  } else if (!cardAtLocation) {
    selectedCard.value.location = location
  }
}

const gameState: Ref<{ cards: GameCard[] }> = ref({
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
      location: { id: 'hand11', type: 'hand', index: 1, player: 'player1', name: 'Hand' } as Location,
      owner: 'player1',
      buffs: {},
      debuffs: {},
      faceUp: true,
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
      location: { id: 'hand12', type: 'hand', index: 2, player: 'player1', name: 'Hand' } as Location,
      owner: 'player1',
      buffs: {},
      debuffs: {},
      faceUp: true,
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
      damage: 'fire',
      description: 'A fire breathing dragon',
      effect: 'He kills people',
      rarity: 'rare',
      location: { id: 'hand23', type: 'hand', index: 3, player: 'player2', name: 'Hand' } as Location,
      owner: 'player2',
      buffs: {},
      debuffs: {},
      faceUp: true,
      defensePosition: false,
    },
    {
      id: 3,
      gameId: '4',
      name: 'Dragon',
      image: cardImg,
      atk: 12,
      def: 8,
      cost: 2,
      type: 'unit',
      race: 'dragon',
      damage: 'fire',
      description: 'A fire breathing dragon',
      effect: 'He kills people',
      rarity: 'rare',
      location: { id: 'hand24', type: 'hand', index: 4, player: 'player2', name: 'Hand' } as Location,
      owner: 'player2',
      buffs: {},
      debuffs: {},
      faceUp: true,
      defensePosition: false,
    },
    {
      id: 2,
      gameId: '5',
      name: 'Effect',
      image: effectImg,
      cost: 0,
      type: 'effect',
      description: 'If you control a Warrior unit, you can add one spent unit to your hand.',
      location: { id: 'hand13', type: 'hand', index: 3, player: 'player1', name: 'Hand' } as Location,
      owner: 'player1',
      buffs: {},
      debuffs: {},
      faceUp: true,
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
      location: { id: 'hand22', type: 'hand', index: 2, player: 'player2', name: 'Hand' } as Location,
      owner: 'player2',
      buffs: {},
      debuffs: {},
      faceUp: true,
      defensePosition: false,
      effects: [
        {
          trigger: Event.TARGETED_EFFECT,
          conditions: [
            { comparitor: 'equals', key: 'race', value: 'dragon' },
            { combinator: 'and', comparitor: 'equals', key: 'location.type', value: 'unit' },
            { combinator: 'and', comparitor: 'equals', key: 'owner', value: 'player2' },
          ],
          effect: 'summon_unit',
          targetType: 'spent_unit',
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
      location: { id: 'hand14', type: 'hand', index: 1, player: 'player1', name: 'Trap' } as Location,
      owner: 'player1',
      buffs: {},
      debuffs: {},
      faceUp: true,
      defensePosition: false,
      effects: [{ trigger: Event.TARGETED_ATTACK, effect: 'negate_attack' }],
    },
  ],
})
</script>

<style scoped></style>
