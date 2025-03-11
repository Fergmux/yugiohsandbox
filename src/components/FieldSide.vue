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
  viewer?: boolean
}>()
const i = computed(() => props.interactive || undefined)
const iv = computed(() => i.value || props.viewer || undefined)

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

const selectCard = (card?: YugiohCard | null, location?: keyof BoardSide, index?: number) => {
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

const showToOpponent = (index: number) => {
  const card = getCard('hand', index)
  if (!card) return
  card.revealed = !card.revealed
  updateGame()
}
const giveToOpponent = (index: number) => {
  const card = getCard('hand', index)
  if (!card) return
  gameState.value[opponentDeck.value].hand.push({ ...card, faceDown: false })
  gameState.value[props.deck].hand.splice(index, 1)
  updateGame()
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
      const orientationOptions =
        selectedCardLocation.value === 'field' || selectedCardLocation.value === 'zones'
          ? {}
          : { faceDown: false, defence: false }
      gameState.value[props.deck][destination][index] = {
        ...card,
        ...orientationOptions,
        ...options,
      }
    } else {
      // otherwise, insert the card at the target index (deck)
      gameState.value[props.deck][destination].splice(index, 0, {
        ...card,
        faceDown: true,
        defence: false,
        counters: 0,
        ...options,
      })
    }
  } else {
    // if there's no index, move the card to the target location
    if (destination === 'deck' || destination === 'extra') {
      gameState.value[props.deck][destination].unshift({
        ...card,
        faceDown: true,
        defence: false,
        counters: 0,
        ...options,
      })
    } else {
      // hand/gy/banished
      const orientationOptions = destination === 'banished' ? {} : { faceDown: false }
      gameState.value[props.deck][destination].unshift({
        ...card,
        ...orientationOptions,
        defence: false,
        counters: 0,
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

const handleBanishedAction = (action: string) => {
  switch (action) {
    case 'face-down':
      moveCard('banished', 0, { faceDown: true })
      break
  }
}

const handleIncrement = (count: number, location: keyof BoardSide, index: number) => {
  const card = getCard(location, index)
  if (!card) return
  card.counters = (card.counters || 0) + count
  updateGame()
}
</script>
<template>
  <!-- PLAYER -->
  <div>
    <div class="grid w-full grid-cols-7 gap-2">
      <!-- BANISHED/EXTRA -->
      <template v-if="i || (viewer && props.deck === 'cards1')">
        <!-- OPPONENT BANISHED -->
        <card-slot
          class="bg-gray-200"
          :cards="gameState[opponentDeck].banished"
          :hint="gameState[opponentDeck].banished.length"
        />
        <div @click="resetSelectedCard"></div>
        <!-- EXTRA 0 -->
        <card-slot
          :card="extraZones[0]"
          @click="i && zoneIsFree(0) && handleFieldClick(0, 'zones')"
          @click.right.prevent="
            (!extraZones[0]?.faceDown || zoneIsFree(0) || viewer) &&
            inspectCard(extraZones[0], 'zones')
          "
          class="bg-blue-800"
          :selected="isSelected('zones', 0)"
          :actions="zoneIsFree(0) ? getActions('zones', 0) : []"
          :hint="
            (viewer || zoneIsFree(0)) && extraZones[0]?.faceDown ? extraZones[0]?.name : undefined
          "
          :controls="i && !!extraZones[0]"
          :counters="extraZones[0]?.counters"
          @action="(evt) => i && handleAction(evt, 'zones', 0)"
          @increment="(evt) => i && handleIncrement(evt, 'zones', 0)"
        />
        <div @click="resetSelectedCard"></div>
        <!-- EXTRA 1 -->
        <card-slot
          :card="extraZones[1]"
          @click="i && zoneIsFree(1) && handleFieldClick(1, 'zones')"
          @click.right.prevent="
            (!extraZones[1]?.faceDown || zoneIsFree(1) || viewer) &&
            inspectCard(extraZones[1], 'zones')
          "
          class="bg-blue-800"
          :selected="isSelected('zones', 1)"
          :actions="i && zoneIsFree(1) ? getActions('zones', 1) : []"
          :hint="
            (viewer || zoneIsFree(1)) && extraZones[1]?.faceDown ? extraZones[1]?.name : undefined
          "
          :controls="i && !!extraZones[1]"
          :counters="extraZones[1]?.counters"
          @action="(evt) => handleAction(evt, 'zones', 1)"
          @increment="(evt) => i && handleIncrement(evt, 'zones', 1)"
        />
        <div @click="resetSelectedCard"></div>
        <!-- BANISHED -->
        <card-slot
          class="bg-gray-200"
          :cards="getCards('banished')"
          @click.stop="
            i &&
            (selectedCard
              ? moveCard('banished')
              : selectCard(getCard('banished', 0), 'banished', 0))
          "
          @click.right.prevent="i && inspectCards('banished')"
          :hint="getCards('banished').length"
          :actions="i && ['face-down']"
          @action="(evt) => i && handleBanishedAction(evt)"
          :selected-index="i && selectedCardLocation === 'banished' && selectedCardIndex"
        />
      </template>

      <!-- TOP ROW -->
      <card-slot
        v-for="index in topRow"
        :key="index"
        :card="getCard('field', index)"
        :class="index === 0 ? 'bg-green-600' : 'bg-yellow-700'"
        @click.stop="i && handleFieldClick(index)"
        @click.right.prevent="
          (!getCard('field', index)?.faceDown || iv) &&
          inspectCard(getCard('field', index), 'field')
        "
        :selected="i && isSelected('field', index)"
        :actions="i && getActions('field', index)"
        :hint="iv && getCard('field', index)?.faceDown ? getCard('field', index)?.name : undefined"
        :controls="i && !!getCard('field', index)"
        :counters="getCard('field', index)?.counters"
        @action="(evt) => i && handleAction(evt, 'field', index)"
        @increment="(evt) => i && handleIncrement(evt, 'field', index)"
      />
      <!-- GRAVEYARD -->
      <card-slot
        class="bg-gray-700"
        :cards="getCards('graveyard')"
        :hint="getCards('graveyard').length"
        :selected-index="i && selectedCardLocation === 'graveyard' && selectedCardIndex"
        @click.stop="
          i &&
          (selectedCard
            ? moveCard('graveyard')
            : selectCard(getCard('graveyard', 0), 'graveyard', 0))
        "
        @click.right.prevent="iv && inspectCards('graveyard')"
      />
      <!-- EXTRA DECK -->
      <card-slot
        class="bg-violet-800"
        :cards="getCards('extra')"
        :hint="getCards('extra').length"
        @click.right.prevent="iv && inspectCards('extra')"
        @click.stop="i && (selectedCard ? moveCard('extra') : inspectCards('extra'))"
        :selected-index="i && selectedCardLocation === 'extra' && selectedCardIndex"
      />
      <!-- BOTTOM ROW -->
      <card-slot
        v-for="index in bottomRow"
        :key="index"
        :card="getCard('field', index)"
        class="bg-teal-600"
        @click.stop="i && handleFieldClick(index)"
        @click.right.prevent="
          (!getCard('field', index)?.faceDown || iv) &&
          inspectCard(getCard('field', index), 'field')
        "
        :selected="i && isSelected('field', index)"
        :actions="i && getActions('field', index)"
        :hint="iv && getCard('field', index)?.faceDown ? getCard('field', index)?.name : undefined"
        :controls="i && !!getCard('field', index)"
        :counters="getCard('field', index)?.counters"
        @action="(evt) => i && handleAction(evt, 'field', index)"
        @increment="(evt) => i && handleIncrement(evt, 'field', index)"
      />
      <!-- DECK -->
      <card-slot
        class="bg-amber-900"
        :cards="getCards('deck')"
        :hint="getCards('deck').length"
        @click.stop="i && drawCard('deck')"
        @click.right.prevent="iv && inspectCards('deck')"
        :count="getCards('deck').length"
        :actions="i && deckActions"
        @action="(evt) => i && handleDeckAction(evt)"
        :selected-index="i && selectedCardLocation === 'deck' && selectedCardIndex"
      />
    </div>
    <div @click="i && moveCard('hand')" class="mt-4 flex max-h-80 w-full justify-center">
      <div v-for="(card, index) in getCards('hand')" :key="`${card?.id}+${index}`" class="relative">
        <img
          v-if="card"
          :class="{
            'border-4 border-yellow-200': isSelected('hand', index),
          }"
          class="h-auto max-h-80 max-w-full min-w-0 flex-[1,1,auto] object-contain"
          :src="getS3ImageUrl(iv || card.revealed ? card.id : 0)"
        />
        <div
          class="absolute top-0 left-0 h-full w-full opacity-0 hover:opacity-100"
          @click.stop="i && selectCard(card, 'hand', index)"
          @click.right.prevent="iv && inspectCard(card, 'hand')"
          @dragstart.prevent=""
        >
          <div class="absolute bottom-0 left-1/2 flex -translate-x-1/2">
            <button
              title="Reveal"
              @click.stop="showToOpponent(index)"
              class="m-1 rounded-full border-1 border-gray-300 bg-gray-400 p-2 leading-1 text-black"
            >
              <span class="material-icons">
                {{ getCard('hand', index)?.revealed ? 'visibility_off' : 'visibility' }}
              </span>
            </button>
            <button
              title="Give"
              @click.stop="giveToOpponent(index)"
              class="m-1 rounded-full border-1 border-gray-300 bg-gray-400 p-2 leading-1 text-black"
            >
              <span class="material-icons"> volunteer_activism </span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <inspect-modal
      v-if="inspectedCards"
      :cards="inspectedCards"
      :revealed="iv && inspectedCardsLocation === 'extra' ? inspectedCards : undefined"
      :selected-index="
        selectedCardLocation === inspectedCardsLocation ? selectedCardIndex : undefined
      "
      @close="inspectCard(null, null)"
      @select="(evt) => selectCard(inspectedCards?.[evt], inspectedCardsLocation, evt)"
    />
  </div>
</template>
