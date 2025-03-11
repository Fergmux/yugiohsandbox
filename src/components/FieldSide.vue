<script setup lang="ts">
import CardSlot from '@/components/CardSlot.vue'
import InspectModal from '@/components/InspectModal.vue'
import type { BoardSide, GameState, YugiohCard } from '@/types'
import { getS3ImageUrl } from '@/utils'
import type { Ref } from 'vue'
import { onMounted, onBeforeUnmount } from 'vue'
import { computed, ref } from 'vue'

// Handle game state synchronisation
const props = defineProps<{
  modelValue: GameState
  deck: 'cards1' | 'cards2'
  interactive?: boolean
}>()
const i = computed(() => props.interactive || undefined)

const emit = defineEmits<{
  (e: 'update:modelValue', value: GameState): void
  (e: 'update'): void
}>()

const gameState = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value)
  },
})

const updateGame = async () => {
  emit('update')
}

const extraZones = computed(() =>
  gameState.value[props.deck].zones.map((zone, index) =>
    zone === null ? gameState.value[opponentDeck.value].zones[index] : zone,
  ),
)

// Random constants
const topRow = Array(6)
  .fill(0)
  .map((_, i) => i)
const bottomRow = Array(5)
  .fill(0)
  .map((_, i) => i + 6)

// Utility functions
const opponentDeck = computed(() => (props.deck === 'cards1' ? 'cards2' : 'cards1'))

const getCards = (location: keyof BoardSide) => gameState.value[props.deck][location]

const getCard = (location: keyof BoardSide, index: number) => getCards(location)[index]

const isSelected = (location: keyof BoardSide, index: number) =>
  selectedCardLocation.value === location && selectedCardIndex.value === index

const getActions = (location: keyof BoardSide, index: number) =>
  selectedCard.value && !getCard(location, index)
    ? ['set', 'defence']
    : getCard(location, index)
      ? ['flip', 'position']
      : []

const deckActions = computed(() =>
  selectedCard.value ? ['shuffle-in', 'place-top', 'place-bottom'] : ['shuffle'],
)

const zoneIsFree = (index: number) => gameState.value[opponentDeck.value].zones[index] === null

// Selecting card
const selectedCard: Ref<YugiohCard | undefined> = ref()
const inspectedCards: Ref<YugiohCard[] | undefined> = ref()
const inspectedCardsLocation: Ref<keyof BoardSide | undefined> = ref()
const selectedCardLocation: Ref<keyof BoardSide | undefined> = ref()
const selectedCardIndex: Ref<number | undefined> = ref()

const selectCard = (card?: YugiohCard, location?: keyof BoardSide, index?: number) => {
  if (!card || !location) return
  if (selectedCardLocation.value === location && selectedCardIndex.value === index) {
    resetSelectedCard()
  } else {
    selectedCard.value = card
    selectedCardLocation.value = location
    selectedCardIndex.value = index
  }
}

const resetSelectedCard = () => {
  selectedCard.value = undefined
  selectedCardLocation.value = undefined
  selectedCardIndex.value = undefined
}

onMounted(() => {
  window.addEventListener('keyup', handleKeyUp, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keyup', handleKeyUp, true)
})

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (!inspectedCards.value) {
      resetSelectedCard()
    }
  }
}

const handleFieldClick = (index: number, zone: 'zones' | 'field' = 'field') => {
  const card = getCard(zone, index)
  if (card) {
    selectCard(card, zone, index)
  } else {
    moveCard(zone, index)
  }
}

const inspectCard = (card: YugiohCard | null, location: keyof BoardSide | null) => {
  inspectedCards.value = card ? [card] : undefined
  inspectedCardsLocation.value = location ?? undefined
}

const inspectCards = (location: keyof BoardSide) => {
  const cards = getCards(location)
  inspectedCards.value = cards ? (cards.filter(Boolean) as YugiohCard[]) : undefined
  inspectedCardsLocation.value = location ?? undefined
}

// Moving cards
const drawCard = (source: keyof BoardSide) => {
  if (!gameState.value[props.deck][source].length) return
  const card = gameState.value[props.deck][source].shift()
  if (!card) return
  gameState.value[props.deck].hand.push({ ...card, faceDown: false })
  updateGame()
}

const moveCard = (
  destination: keyof BoardSide,
  index?: number,
  options: { faceDown?: boolean; defence?: boolean } = {},
) => {
  // Check selected card is valid
  if (!selectedCardLocation.value || selectedCardIndex.value === undefined) return
  const card = gameState.value[props.deck][selectedCardLocation.value][selectedCardIndex.value]
  if (!card) return

  // if it's on the field or zones, replace with null
  if (selectedCardLocation.value === 'field' || selectedCardLocation.value === 'zones') {
    gameState.value[props.deck][selectedCardLocation.value].splice(selectedCardIndex.value, 1, null)
  } else {
    // otherwise, remove the card from its location
    gameState.value[props.deck][selectedCardLocation.value].splice(selectedCardIndex.value, 1)
  }

  // if there's an index, move the card to the target location
  if (index != undefined) {
    const target = gameState.value[props.deck][destination][index]
    if (target === null) {
      // if the target is null, replace it with the card (field/zones)
      gameState.value[props.deck][destination][index] = {
        ...card,
        faceDown: false,
        defence: false,
        ...options,
      }
    } else {
      // otherwise, insert the card at the target index (deck)
      gameState.value[props.deck][destination].splice(index, 0, {
        ...card,
        faceDown: true,
        defence: false,
        ...options,
      })
    }
  } else {
    // if there's no index, move the card to the target location
    if (destination === 'deck' || destination === 'extra') {
      gameState.value[props.deck][destination].push({
        ...card,
        faceDown: true,
        defence: false,
        ...options,
      })
    } else {
      gameState.value[props.deck][destination].push({
        ...card,
        faceDown: false,
        defence: false,
        ...options,
      })
    }
  }
  resetSelectedCard()
  updateGame()
  return true
}

const handleAction = (action: string, destination: keyof BoardSide, index: number) => {
  switch (action) {
    case 'set':
      const defence =
        selectedCard.value?.type !== 'Trap Card' && selectedCard.value?.type !== 'Spell Card'
      moveCard(destination, index, { faceDown: true, defence })
      break
    case 'defence':
      moveCard(destination, index, { defence: true })
      break
    case 'flip':
      const cardToFlip = getCard(destination, index)
      if (!cardToFlip) return
      cardToFlip.faceDown = !cardToFlip.faceDown
      updateGame()
      break
    case 'position':
      const cardToChange = getCard(destination, index)
      if (!cardToChange) return
      cardToChange.defence = !cardToChange.defence
      updateGame()
      break
  }
}

const handleDeckAction = (action: string) => {
  const options = { faceDown: true, defence: false }
  switch (action) {
    case 'shuffle-in':
      if (!selectedCard.value) return
      const randomIndex = Math.floor(Math.random() * (gameState.value[props.deck].deck.length + 1))
      moveCard('deck', randomIndex, options)
      break
    case 'place-top':
      if (!selectedCard.value) return
      moveCard('deck', 0, options)
      break
    case 'place-bottom':
      if (!selectedCard.value) return
      moveCard('deck', gameState.value[props.deck].deck.length, options)
      break
    case 'shuffle':
      gameState.value[props.deck].deck.sort(() => Math.random() - 0.5)
      updateGame()
      break
  }
}
</script>
<template>
  <!-- PLAYER -->
  <div>
    <div class="grid w-full grid-cols-7 gap-2">
      <!-- BANISHED/EXTRA -->
      <template v-if="i">
        <card-slot
          :cards="gameState[opponentDeck].banished"
          :hint="gameState[opponentDeck].banished.length"
        />
        <div @click="resetSelectedCard"></div>
        <card-slot
          :card="extraZones[0]"
          @click="zoneIsFree(0) && handleFieldClick(0, 'zones')"
          @click.right.prevent="
            (!extraZones[0]?.faceDown || zoneIsFree(0)) && inspectCard(extraZones[0], 'zones')
          "
          :selected="isSelected('zones', 0)"
          :actions="zoneIsFree(0) ? getActions('zones', 0) : []"
          :hint="
            zoneIsFree(0) && getCard('zones', 0)?.faceDown ? getCard('zones', 0)?.name : undefined
          "
          @action="(evt) => i && handleAction(evt, 'zones', 0)"
        />
        <div @click="resetSelectedCard"></div>
        <card-slot
          :card="extraZones[1]"
          @click="zoneIsFree(1) && handleFieldClick(1, 'zones')"
          @click.right.prevent="
            (!extraZones[1]?.faceDown || zoneIsFree(1)) && inspectCard(extraZones[1], 'zones')
          "
          :selected="isSelected('zones', 1)"
          :actions="zoneIsFree(1) ? getActions('zones', 1) : []"
          :hint="
            zoneIsFree(1) && getCard('zones', 1)?.faceDown ? getCard('zones', 1)?.name : undefined
          "
          @action="(evt) => handleAction(evt, 'zones', 1)"
        />
        <div @click="resetSelectedCard"></div>
        <card-slot
          :cards="getCards('banished')"
          @click="moveCard('banished')"
          @click.right.prevent="i && inspectCards('banished')"
          :hint="getCards('banished').length"
        />
      </template>

      <!-- TOP ROW -->
      <card-slot
        v-for="index in topRow"
        :key="index"
        :card="getCard('field', index)"
        @click.stop="i && handleFieldClick(index)"
        @click.right.prevent="
          (!getCard('field', index)?.faceDown || i) && inspectCard(getCard('field', index), 'field')
        "
        :selected="i && isSelected('field', index)"
        :actions="i && getActions('field', index)"
        :hint="i && getCard('field', index)?.faceDown ? getCard('field', index)?.name : undefined"
        @action="(evt) => i && handleAction(evt, 'field', index)"
      />
      <!-- GRAVEYARD -->
      <card-slot
        :cards="getCards('graveyard')"
        :hint="getCards('graveyard').length"
        @click.stop="i && moveCard('graveyard')"
        @click.right.prevent="i && inspectCards('graveyard')"
      />
      <!-- EXTRA DECK -->
      <card-slot
        :cards="getCards('extra')"
        :hint="getCards('extra').length"
        @click.right.prevent="i && inspectCards('extra')"
        @click.stop="i && selectedCard && moveCard('extra')"
        :selected-index="i && selectedCardLocation === 'extra' && selectedCardIndex"
      />
      <!-- BOTTOM ROW -->
      <card-slot
        v-for="index in bottomRow"
        :key="index"
        :card="getCard('field', index)"
        @click.stop="i && handleFieldClick(index)"
        @click.right.prevent="
          (!getCard('field', index)?.faceDown || i) && inspectCard(getCard('field', index), 'field')
        "
        :selected="i && isSelected('field', index)"
        :actions="i && getActions('field', index)"
        :hint="i && getCard('field', index)?.faceDown ? getCard('field', index)?.name : undefined"
        @action="(evt) => i && handleAction(evt, 'field', index)"
      />
      <!-- DECK -->
      <card-slot
        :cards="getCards('deck')"
        :hint="getCards('deck').length"
        @click.stop="i && drawCard('deck')"
        @click.right.prevent="i && inspectCards('deck')"
        :count="getCards('deck').length"
        :actions="i && deckActions"
        @action="(evt) => i && handleDeckAction(evt)"
        :selected-index="i && selectedCardLocation === 'deck' && selectedCardIndex"
      />
    </div>
    <div @click="i && moveCard('hand')" class="mt-4 flex max-h-80 w-full justify-center">
      <template v-for="(card, index) in getCards('hand')" :key="`${card?.id}+${index}`">
        <img
          v-if="card"
          :class="{
            'border-4 border-yellow-200': isSelected('hand', index),
          }"
          class="h-auto max-h-80 max-w-full min-w-0 flex-[1,1,auto] object-contain"
          @click.stop="i && selectCard(card, 'hand', index)"
          @click.right.prevent="i && inspectCard(card, 'hand')"
          @dragstart.prevent=""
          :src="getS3ImageUrl(i ? card.id : 0)"
        />
      </template>
    </div>
    <inspect-modal
      v-if="inspectedCards"
      :cards="inspectedCards"
      :selected-index="
        selectedCardLocation === inspectedCardsLocation ? selectedCardIndex : undefined
      "
      @close="inspectCard(null, null)"
      @select="(evt) => selectCard(inspectedCards?.[evt], inspectedCardsLocation, evt)"
    />
  </div>
</template>
