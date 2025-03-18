<script setup lang="ts">
import CardSlot from '@/components/CardSlot.vue'
import InspectModal from '@/components/InspectModal.vue'
import type { BoardSide, GameState, YugiohCard } from '@/types'
import { getS3ImageUrl } from '@/utils'
import type { Ref } from 'vue'
import { onMounted, onBeforeUnmount } from 'vue'
import { computed, ref } from 'vue'
import LifePoints from '@/components/LifePoints.vue'

type CardLocation = keyof BoardSide | 'attached'

// Handle game state synchronisation
const props = defineProps<{
  modelValue: GameState
  player: 'player1' | 'player2'
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
  gameState.value.cards[props.player].zones.map((zone, index) =>
    zone === null ? gameState.value.cards[opponentPlayerKey.value].zones[index] : zone,
  ),
)

// Random constants
const topRow = Array(6)
  .fill(0)
  .map((_, i) => i)
const bottomRow = Array(5)
  .fill(0)
  .map((_, i) => i + 6)

const updateLifePoints = (value: number, player: 'player1' | 'player2') => {
  gameState.value.lifePoints[player] += value
  updateGame()
}

// Utility functions

const getCardData = (key: 'player1' | 'player2') => gameState.value.cards[key]
const cards = computed(() => getCardData(props.player))
const opponentCards = computed(() => getCardData(opponentPlayerKey.value))
const opponentPlayerKey = computed(() => (props.player === 'player1' ? 'player2' : 'player1'))

const getCards = (location: keyof BoardSide) => cards.value[location]

const getCard = (location: keyof BoardSide, index: number) => getCards(location)[index]

const isSelected = (location: keyof BoardSide, index: number) =>
  selectedCardLocation.value === location && selectedCardIndex.value === index

const getActions = (location: keyof BoardSide, index: number) => {
  if (selectedCard.value) {
    return getCard(location, index) ? ['attach'] : ['set', 'defence']
  } else {
    return getCard(location, index) ? ['flip', 'position'] : []
  }
}

const deckActions = computed(() =>
  selectedCard.value ? ['shuffle-in', 'place-top', 'place-bottom'] : ['shuffle', 'search'],
)

const zoneIsFree = (index: number) => opponentCards.value.zones[index] === null

// Selecting card
const selectedCard: Ref<YugiohCard | undefined> = ref()
const inspectedCards: Ref<YugiohCard[] | YugiohCard | undefined> = ref()
const inspectedCardsLocation: Ref<CardLocation | undefined> = ref()
const selectedCardLocation: Ref<CardLocation | undefined> = ref()
const selectedCardIndex: Ref<number | undefined> = ref()
const revealDeck = ref(false)

const selectCard = (card?: YugiohCard | null, location?: CardLocation, index?: number) => {
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
  const attachedCards = getCards('attached').filter(
    (c) => c?.attached === card?.uid,
  ) as YugiohCard[]
  inspectedCards.value =
    attachedCards.length && card ? [card, ...attachedCards] : (card ?? undefined)
  inspectedCardsLocation.value = attachedCards.length ? 'attached' : (location ?? undefined)
}

const inspectCards = (location?: CardLocation, playerKey?: 'player1' | 'player2') => {
  if (!location) return
  const cards = getCardData(playerKey ?? props.player)[location]
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
  opponentCards.value.hand.push({ ...card, faceDown: false })
  getCards('hand').splice(index, 1)
  updateGame()
}

// Moving cards
const drawCard = (source: keyof BoardSide) => {
  if (!getCards(source).length) return
  const card = getCards(source).shift()
  if (!card) return
  getCards('hand').push({ ...card, faceDown: false })
  updateGame()
}

const drawFromInspected = (destination: keyof BoardSide, index: number, faceDown?: boolean) => {
  const card = Array.isArray(inspectedCards.value)
    ? inspectedCards.value[index]
    : inspectedCards.value
  let newIndex = index
  if (inspectedCardsLocation.value === 'attached') {
    newIndex = getCards('attached').findIndex((c) => c?.uid === card?.uid)
  }
  debugger
  selectCard(card, inspectedCardsLocation.value, newIndex)
  moveCard(destination, undefined, { faceDown })
  inspectCard(
    Array.isArray(inspectedCards.value) ? inspectedCards.value[0] : (inspectedCards.value ?? null),
    'field',
  )
}

const removeSelectedCard = () => {
  if (!selectedCardLocation.value || selectedCardIndex.value === undefined) return
  // if it's on the field or zones, replace with null
  if (selectedCardLocation.value === 'field' || selectedCardLocation.value === 'zones') {
    cards.value[selectedCardLocation.value].splice(selectedCardIndex.value, 1, null)
  } else {
    // otherwise, remove the card from its location
    cards.value[selectedCardLocation.value].splice(selectedCardIndex.value, 1)
  }
}

const moveCard = (
  destination?: keyof BoardSide,
  index?: number,
  options?: { faceDown?: boolean; defence?: boolean } = {},
) => {
  // Check selected card is valid
  debugger
  if (!selectedCardLocation.value || selectedCardIndex.value === undefined) return
  const card = getCard(selectedCardLocation.value, selectedCardIndex.value)
  if (!card || !destination) return

  if (destination === 'tokens' && card.type !== 'Token') return
  if (card.type === 'Token' && !['tokens', 'field', 'hand'].includes(destination)) return

  removeSelectedCard()

  // if there's an index, move the card to the target location
  if (index != undefined) {
    const target = getCard(destination, index)
    if (target === null) {
      // if the target is null, replace it with the card (field/zones)
      const orientationOptions =
        selectedCardLocation.value === 'field' || selectedCardLocation.value === 'zones'
          ? {}
          : { faceDown: false, defence: false }
      getCards(destination)[index] = {
        ...card,
        ...orientationOptions,
        ...options,
      }
    } else {
      // otherwise, insert the card at the target index (deck)
      getCards(destination).splice(index, 0, {
        ...card,
        faceDown: true,
        defence: false,
        counters: 0,
        ...options,
      })
    }
  } else {
    // if there's no index, move the card to the target location
    if (destination === 'deck' || destination === 'extra' || destination === 'tokens') {
      getCards(destination).unshift({
        ...card,
        faceDown: true,
        defence: false,
        counters: 0,
        ...options,
      })
    } else {
      // hand/gy/banished
      const orientationOptions = destination === 'banished' ? {} : { faceDown: false }
      const method = destination === 'hand' ? 'push' : 'unshift'
      getCards(destination)[method]({
        ...card,
        defence: false,
        counters: 0,
        ...options,
        ...orientationOptions,
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
    case 'attach':
      if (!selectedCard.value) return
      selectedCard.value.attached = getCard('field', index)?.uid
      moveCard('attached')
      break
  }
}

const handleDeckAction = (action: string) => {
  const options = { faceDown: true, defence: false }
  switch (action) {
    case 'shuffle-in':
      if (!selectedCard.value) return
      const randomIndex = Math.floor(Math.random() * (getCards('deck').length + 1))
      moveCard('deck', randomIndex, options)
      break
    case 'place-top':
      if (!selectedCard.value) return
      moveCard('deck', 0, options)
      break
    case 'place-bottom':
      if (!selectedCard.value) return
      moveCard('deck', getCards('deck').length, options)
      break
    case 'shuffle':
      getCards('deck').sort(() => Math.random() - 0.5)
      updateGame()
      break
    case 'search':
      revealDeck.value = true
      inspectCards('deck')
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
  const newCount = (card.counters || 0) + count
  card.counters = newCount < 0 ? 0 : newCount
  updateGame()
}

const closeInspectModal = () => {
  revealDeck.value = false
  debugger
  inspectCard(null, null)
}

const showCards = computed(() => {
  const revealedCards = [
    ...getCards('extra'),
    ...getCards('tokens'),
    ...getCards('field'),
    ...extraZones.value,
  ]
  const cards = revealDeck.value ? [...revealedCards, ...getCards('deck')] : revealedCards
  return cards.filter(Boolean) as YugiohCard[]
})
</script>
<template>
  <!-- PLAYER -->
  <div class="h-1/2">
    <div class="grid grid-cols-7 gap-2">
      <!-- BANISHED/EXTRA -->
      <template v-if="i || (viewer && props.player === 'player1')">
        <!-- OPPONENT BANISHED -->
        <card-slot
          class="bg-gray-200"
          :name="'Banished Zone'"
          :cards="opponentCards.banished"
          :hint="opponentCards.banished.length"
          @click.right.prevent="inspectCards('banished', opponentPlayerKey)"
        />
        <life-points
          :life-points="gameState.lifePoints[opponentPlayerKey]"
          @update="updateLifePoints($event, opponentPlayerKey)"
        />
        <!-- EXTRA 0 -->
        <card-slot
          :card="extraZones[0]"
          :name="'Extra Monster Zone'"
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
          :controls="!!getCard('zones', 0)"
          :counters="extraZones[0]?.counters"
          @action="(evt) => i && handleAction(evt, 'zones', 0)"
          @increment="(evt) => i && handleIncrement(evt, 'zones', 0)"
        />
        <!-- TOKENS -->
        <card-slot
          class=""
          :name="'Tokens'"
          :cards="getCards('tokens')"
          :hint="getCards('tokens').length"
          @click.right.prevent="iv && inspectCards('tokens')"
          @click.stop="i && (selectedCard ? moveCard('tokens') : drawCard('tokens'))"
          :actions="i && ['search']"
          @action="i && inspectCards('tokens')"
          :selected-index="i && selectedCardLocation === 'tokens' && selectedCardIndex"
        />
        <!-- EXTRA 1 -->
        <card-slot
          :card="extraZones[1]"
          :name="'Extra Monster Zone'"
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
          :controls="!!getCard('zones', 1)"
          :counters="extraZones[1]?.counters"
          @action="(evt) => handleAction(evt, 'zones', 1)"
          @increment="(evt) => i && handleIncrement(evt, 'zones', 1)"
        />
        <life-points
          :life-points="gameState.lifePoints[props.player]"
          reverse
          @update="updateLifePoints($event, props.player)"
        />
        <!-- BANISHED -->
        <card-slot
          class="bg-gray-200"
          :cards="getCards('banished')"
          :name="'Banished Zone'"
          @click.stop="
            i &&
            (selectedCard
              ? moveCard('banished')
              : selectCard(getCard('banished', 0), 'banished', 0))
          "
          @click.right.prevent="inspectCards('banished')"
          :hint="getCards('banished').length"
          :actions="i && selectedCard ? ['face-down'] : []"
          @action="(evt) => i && handleBanishedAction(evt)"
          :selected-index="i && selectedCardLocation === 'banished' && selectedCardIndex"
        />
      </template>

      <!-- TOP ROW -->
      <card-slot
        v-for="index in topRow"
        :key="index"
        :name="index ? 'Monster Card Zone' : 'Field Card Zone'"
        :card="getCard('field', index)"
        :cards="[
          getCard('field', index),
          ...(getCards('attached').filter((c) => c?.attached === getCard('field', index)?.uid) ??
            []),
        ]"
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
        :name="'Graveyard'"
        :hint="getCards('graveyard').length"
        :selected-index="i && selectedCardLocation === 'graveyard' && selectedCardIndex"
        @click.stop="
          i &&
          (selectedCard
            ? moveCard('graveyard')
            : selectCard(getCard('graveyard', 0), 'graveyard', 0))
        "
        @click.right.prevent="inspectCards('graveyard')"
      />
      <!-- EXTRA DECK -->
      <card-slot
        class="bg-violet-800"
        :cards="getCards('extra')"
        :name="'Extra Deck Zone'"
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
        :name="'Spell & Trap Card Zone'"
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
        :name="'Deck Zone'"
        :hint="getCards('deck').length"
        @click.stop="i && drawCard('deck')"
        @click.right.prevent="iv && inspectCards('deck')"
        :actions="i && deckActions"
        @action="(evt) => i && handleDeckAction(evt)"
        :selected-index="i && selectedCardLocation === 'deck' && selectedCardIndex"
      />
    </div>
    <div @click="i && moveCard('hand')" class="mt-4 flex min-h-80 w-full justify-center">
      <div v-for="(card, index) in getCards('hand')" :key="`${card?.id}+${index}`" class="relative">
        <img
          v-if="card"
          :class="{
            'border-4 border-yellow-200': isSelected('hand', index),
          }"
          class="h-full max-h-80 max-w-full min-w-0 object-contain"
          :src="getS3ImageUrl(iv || card.revealed ? card.id : 0)"
        />
        <div
          class="absolute top-0 left-0 h-full w-full opacity-0 hover:opacity-100"
          @click.stop="i && selectCard(card, 'hand', index)"
          @click.right.prevent="(iv || card?.revealed) && inspectCard(card, 'hand')"
          @dragstart.prevent=""
        >
          <div v-if="i" class="absolute bottom-0 left-1/2 flex -translate-x-1/2">
            <button
              title="Reveal"
              @click.stop="showToOpponent(index)"
              class="m-1 rounded-full border-1 border-gray-300 bg-gray-400 p-2 leading-1 text-black"
            >
              <span class="material-symbols-outlined">
                {{ getCard('hand', index)?.revealed ? 'visibility_off' : 'visibility' }}
              </span>
            </button>
            <button
              title="Give"
              @click.stop="giveToOpponent(index)"
              class="m-1 rounded-full border-1 border-gray-300 bg-gray-400 p-2 leading-1 text-black"
            >
              <span class="material-symbols-outlined"> volunteer_activism </span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <inspect-modal
      v-if="inspectedCards"
      :cards="inspectedCards"
      :show-cards="showCards"
      :inspected-cards-location="inspectedCardsLocation"
      :selected-index="
        selectedCardLocation === inspectedCardsLocation ? selectedCardIndex : undefined
      "
      @close="closeInspectModal"
      @select="
        (index) =>
          selectCard(
            Array.isArray(inspectedCards) ? inspectedCards[index] : inspectedCards,
            inspectedCardsLocation,
            index,
          )
      "
      @draw="drawFromInspected"
    />
  </div>
</template>
