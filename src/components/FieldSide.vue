<script setup lang="ts">
import CardSlot from '@/components/CardSlot.vue'
import InspectModal from '@/components/InspectModal.vue'
import type { BoardSide, GameState, YugiohCard } from '@/types'
import { getS3ImageUrl } from '@/utils'
import type { Ref } from 'vue'
import { onMounted, onBeforeUnmount } from 'vue'
import { computed, ref } from 'vue'
import LifePoints from '@/components/LifePoints.vue'
import { nextTick } from 'vue'
import { zip, debounce } from 'lodash'
import IconButton from './IconButton.vue'

type CardLocation = keyof BoardSide | 'attached'

type Player = 'player1' | 'player2'

// Handle game state synchronisation
const props = defineProps<{
  modelValue: GameState
  player: Player
  interactive?: boolean
  viewer?: boolean
}>()
const i = computed(() => props.interactive || undefined)
const iv = computed(() => i.value || props.viewer || undefined)
const hideInspectControls = ref(false)

const emit = defineEmits<{
  (e: 'update:modelValue', value: GameState): void
  (e: 'update'): void
  (e: 'log', action: string): void
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

const revealCard = () => {
  log(`revealed a card in ${zoneName(inspectedCardsLocation.value)}`)
}

const log = (action: string) => {
  emit('log', action)
}
const cardName = (card?: YugiohCard) => (card?.faceDown ? 'a card' : card?.name)
const zoneNameMap: Record<keyof BoardSide, string> = {
  field: 'the field',
  zones: 'an extra zone',
  hand: 'their hand',
  banished: 'the banished zone',
  deck: 'the deck',
  extra: 'the extra deck',
  tokens: 'the token deck',
  graveyard: 'the graveyard',
  attached: 'a monster',
}
const zoneName = (zone?: keyof BoardSide) => (zone ? zoneNameMap[zone] : undefined)

const debouncedUpdateCardStats = debounce((name: string, stat?: 'attack' | 'defence') => {
  log(`updated ${name}'s' ${stat}`)
  updateGame()
}, 1000)

const extraZones = computed(() =>
  gameState.value.cards[props.player].zones.map((zone, index) =>
    zone === null ? gameState.value.cards[opponentPlayerKey.value].zones[index] : zone,
  ),
)

const updateLifePoints = (value: number, player: Player) => {
  gameState.value.lifePoints[player] += value
  log(`set their life points to ${gameState.value.lifePoints[player]}`)
  updateGame()
}

// Utility functions

const getCardData = (key: Player) => gameState.value.cards[key]
const cards = computed(() => getCardData(props.player))
const opponentCards = computed(() => getCardData(opponentPlayerKey.value))
const opponentPlayerKey = computed(() => (props.player === 'player1' ? 'player2' : 'player1'))

const getCards = (location: keyof BoardSide) => cards.value[location]

const getCard = (location: keyof BoardSide, index: number) => getCards(location)[index]

const isSelected = (location: keyof BoardSide, index: number) =>
  selectedCardLocation.value === location && selectedCardIndex.value === index

const getActions = (location: keyof BoardSide, index: number) => {
  if (selectedCard.value) {
    const targetCard = getCard(location, index)
    const actions = targetCard?.uid !== selectedCard.value?.uid ? ['attach'] : []
    return targetCard ? actions : ['set', 'defence']
  } else {
    return getCard(location, index) ? ['flip', 'position'] : []
  }
}

const topRow = computed(() => getCards('field').slice(0, 6))
const bottomRowIndexes = Array(5)
  .fill(0)
  .map((_, i) => i + 6)
const bottomRow = computed(
  () => zip(getCards('field').slice(6), bottomRowIndexes) as [YugiohCard, number][],
)

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

const cardIndex = computed(() => {
  const fieldIndex = getCards('field').findIndex(
    (c) =>
      c?.uid ===
      (Array.isArray(inspectedCards.value)
        ? inspectedCards.value[0]?.uid
        : inspectedCards.value?.uid),
  )

  const zoneIndex = getCards('zones').findIndex(
    (c) =>
      c?.uid ===
      (Array.isArray(inspectedCards.value)
        ? inspectedCards.value[0]?.uid
        : inspectedCards.value?.uid),
  )

  return inspectedCardsLocation.value === 'field' ||
    inspectedCardsLocation.value === 'zones' ||
    inspectedCardsLocation.value === 'attached'
    ? fieldIndex === -1
      ? zoneIndex
      : fieldIndex
    : undefined
})

const selectCard = (location?: CardLocation, index?: number) => {
  // debugger
  if (location == null || index == null) return
  if (selectedCardLocation.value === location && selectedCardIndex.value === index) {
    resetSelectedCard()
  } else {
    selectedCard.value = getCard(location, index) ?? undefined
    selectedCardLocation.value = location
    selectedCardIndex.value = index
  }
}

const selectInspectedCard = (index: number) => {
  if (inspectedCardsLocation.value === 'attached') {
    if (index === 0) {
      const card = Array.isArray(inspectedCards.value)
        ? inspectedCards.value[0]
        : inspectedCards.value
      const fieldIndex = getCards('field').findIndex((c) => c?.uid === card?.uid)
      const index =
        fieldIndex === -1 ? getCards('zones').findIndex((c) => c?.uid === card?.uid) : fieldIndex
      const location = fieldIndex === -1 ? 'zones' : 'field'
      selectCard(location, index)
    } else {
      const card = Array.isArray(inspectedCards.value)
        ? inspectedCards.value[index]
        : inspectedCards.value
      selectCard(
        'attached',
        getCards('attached').findIndex((c) => c?.uid === card?.uid),
      )
    }
  } else {
    selectCard(inspectedCardsLocation.value, index)
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
    selectCard(zone, index)
  } else {
    if (selectedCard.value) {
      if (selectedCardLocation.value === 'field' || selectedCardLocation.value === 'zones') {
        log(
          `moved ${cardName(selectedCard.value)} from ${zoneName(selectedCardLocation.value)} to ${zoneName(zone)}`,
        )
      } else {
        log(`summoned ${selectedCard.value?.name} from ${zoneName(selectedCardLocation.value)}`)
      }
      moveCard(zone, index)
    }
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

const inspectCards = (location?: CardLocation, playerKey?: Player) => {
  if (!location) return
  const cards = getCardData(playerKey ?? props.player)[location]
  inspectedCards.value = cards ? (cards.filter(Boolean) as YugiohCard[]) : undefined
  inspectedCardsLocation.value = location ?? undefined
}

const showToOpponent = (index: number) => {
  const card = getCard('hand', index)
  if (!card) return
  card.revealed = !card.revealed
  log(`revealed ${card.name}`)
  updateGame()
}
const giveToOpponent = (index: number) => {
  const card = getCard('hand', index)
  if (!card) return
  opponentCards.value.hand.push({ ...card, faceDown: false })
  getCards('hand').splice(index, 1)
  log(`gave ${card.name} to their opponent`)
  updateGame()
}

// Moving cards
const drawCard = (source: keyof BoardSide) => {
  if (!getCards(source).length) return
  const card = getCards(source).shift()
  if (!card) return
  getCards('hand').push({ ...card, faceDown: true })
  log(`drew a card from ${zoneName(source)}`)
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

  selectCard(inspectedCardsLocation.value, newIndex)
  logMoveCard(destination, undefined, { faceDown })
  if (inspectedCardsLocation.value === 'attached') {
    inspectCard(
      Array.isArray(inspectedCards.value)
        ? inspectedCards.value[0]
        : (inspectedCards.value ?? null),
      'field',
    )
  } else {
    inspectCards(inspectedCardsLocation.value)
  }
}

const removeCard = (location: keyof BoardSide, index: number) => {
  if (!location || index === undefined) return
  // if it's on the field or zones, replace with null
  if (location === 'field' || location === 'zones') {
    cards.value[location].splice(index, 1, null)
  } else {
    // otherwise, remove the card from its location
    cards.value[location].splice(index, 1)
  }
}

const addCardToDestination = (
  card: YugiohCard,
  destination: keyof BoardSide,
  currentLocation: keyof BoardSide,
  index?: number,
  options?: {
    faceDown?: boolean
    defence?: boolean
    newAttack?: number | null
    newDefence?: number | null
  },
) => {
  if (destination !== 'field' && destination !== 'zones') {
    // If it's leaving the field rest the atk/def modifiers
    options = { ...options, newAttack: null, newDefence: null }
  }
  // if there's an index, move the card to the target location
  if (index != undefined) {
    const target = getCard(destination, index)
    if (target === null) {
      // if the target is null, replace it with the card (field/zones)
      const orientationOptions =
        currentLocation === 'field' || currentLocation === 'zones'
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
}

const moveCard = (
  destination: keyof BoardSide,
  index?: number,
  options?: { faceDown?: boolean; defence?: boolean } = {},
) => {
  // Check selected card is valid
  if (!selectedCardLocation.value || selectedCardIndex.value === undefined) return
  const card = getCard(selectedCardLocation.value, selectedCardIndex.value)
  if (!card) return

  if (destination === 'tokens' && card.type !== 'Token') return
  if (card.type === 'Token' && !['tokens', 'field', 'hand'].includes(destination)) return

  removeCard(selectedCardLocation.value, selectedCardIndex.value)

  const attachedCards = getCards('attached').filter(
    (c) => c?.attached === card?.uid,
  ) as YugiohCard[]
  if (destination !== 'field' && destination !== 'zones' && attachedCards.length) {
    attachedCards.forEach((c) => {
      removeCard(
        'attached',
        attachedCards.findIndex((c) => c?.uid === card?.uid),
      )
      addCardToDestination(c, destination, 'attached', undefined, options)
    })
  }
  addCardToDestination(card, destination, selectedCardLocation.value, index, options)
  resetSelectedCard()
  updateGame()
  return true
}

const logMoveCard = (
  destination: keyof BoardSide,
  index?: number,
  options?: { faceDown?: boolean; defence?: boolean } = {},
) => {
  if (!selectedCard.value || !selectedCardLocation.value) return
  log(
    `moved ${destination === 'graveyard' ? selectedCard.value.name : cardName(selectedCard.value)} from ${zoneName(selectedCardLocation.value)} to ${zoneName(destination)}`,
  )
  moveCard(destination, index, options)
}

const flipCard = (card: YugiohCard) => {
  card.faceDown = !card.faceDown
  log(`flipped ${card.name} ${card.faceDown ? 'face down' : 'face up'}`)
  updateGame()
}

const handleAction = (action: string, destination: keyof BoardSide, index: number) => {
  switch (action) {
    case 'set':
      const defence =
        selectedCard.value?.type !== 'Trap Card' && selectedCard.value?.type !== 'Spell Card'
      log(`set ${cardName(selectedCard.value)} face down`)
      moveCard(destination, index, { faceDown: true, defence })
      break
    case 'defence':
      log(`summoned ${selectedCard.value?.name} in defence mode`)
      moveCard(destination, index, { defence: true })
      break
    case 'flip':
      const cardToFlip = getCard(destination, index)
      if (!cardToFlip) return
      cardToFlip.faceDown = !cardToFlip.faceDown
      log(`flipped ${cardToFlip.name} ${cardToFlip.faceDown ? 'face down' : 'face up'}`)
      updateGame()
      break
    case 'position':
      const cardToChange = getCard(destination, index)
      if (!cardToChange) return
      cardToChange.defence = !cardToChange.defence
      log(
        `changed ${cardName(cardToChange)} to ${cardToChange.defence ? 'defence' : 'attack'} mode`,
      )
      updateGame()
      break
    case 'attach':
      if (!selectedCard.value) return
      const cardsAttachedToSelected = getCards('attached').filter(
        (c) => c?.attached === selectedCard.value?.uid,
      )
      const destinationCard = getCard(destination, index)
      const destinationCardUid = destinationCard?.uid
      if (cardsAttachedToSelected) {
        cardsAttachedToSelected.map((c) => {
          if (c) {
            c.attached = destinationCardUid
          }
        })
      }
      selectedCard.value.attached = destinationCardUid
      log(`attached ${selectedCard.value?.name} to ${destinationCard?.name}`)
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
      log(`shuffled ${cardName(selectedCard.value)} into their deck`)
      moveCard('deck', randomIndex, options)
      break
    case 'place-top':
      if (!selectedCard.value) return
      log(`placed ${cardName(selectedCard.value)} on top of their deck`)
      moveCard('deck', 0, options)
      break
    case 'place-bottom':
      if (!selectedCard.value) return
      log(`placed ${cardName(selectedCard.value)} on the bottom of their deck`)
      moveCard('deck', getCards('deck').length, options)
      break
    case 'shuffle':
      getCards('deck').sort(() => Math.random() - 0.5)
      log(`shuffled their deck`)
      break
    case 'search':
      revealDeck.value = true
      inspectCards('deck')
      log(`searched their deck`)
      break
  }
}

const handleBanishedAction = (action: string) => {
  switch (action) {
    case 'face-down':
      if (!selectedCard.value) return
      log(`banished ${cardName(selectedCard.value)} face down`)
      moveCard('banished', 0, { faceDown: true })
      break
    case 'face-up':
      if (!selectedCard.value) return
      log(`banished ${selectedCard.value?.name} face up`)
      moveCard('banished', 0, { faceDown: false })
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

const closeInspectModal = async () => {
  revealDeck.value = false
  hideInspectControls.value = false
  await nextTick()
  inspectCard(null, null)
}

const showCards = computed(() => {
  const revealedCards = [
    ...getCards('extra'),
    ...getCards('tokens'),
    ...getCards('field'),
    ...getCards('hand'),
    ...extraZones.value,
  ]
  const cards = revealDeck.value ? [...revealedCards, ...getCards('deck')] : revealedCards
  return cards.filter(Boolean) as YugiohCard[]
})

const rotate = computed(() => !i.value)
</script>
<template>
  <!-- PLAYER -->
  <div>
    <div class="grid grid-cols-7 gap-2">
      <!-- BANISHED/EXTRA -->
      <template v-if="i || (viewer && props.player === 'player1')">
        <!-- OPPONENT BANISHED -->
        <card-slot
          class="bg-gray-200"
          :name="'Banished Zone'"
          :cards="opponentCards.banished"
          :hint="opponentCards.banished.length"
          @click.right.prevent="
            (hideInspectControls = true) && inspectCards('banished', opponentPlayerKey)
          "
          :rotate
        />
        <life-points
          :life-points="gameState.lifePoints[opponentPlayerKey]"
          @update="updateLifePoints($event, opponentPlayerKey)"
        />
        <!-- EXTRA 0 -->
        <card-slot
          :card="extraZones[0]"
          :cards="[
            extraZones[0],
            ...(getCards('attached').filter((c) => c?.attached === getCard('zones', 0)?.uid) ?? []),
          ]"
          :name="'Extra Monster Zone'"
          @click="i && zoneIsFree(0) && handleFieldClick(0, 'zones')"
          @click.right.prevent="
            (!extraZones[0]?.faceDown || zoneIsFree(0) || viewer) &&
            inspectCard(extraZones[0], 'zones')
          "
          class="bg-blue-800"
          :selected="isSelected('zones', 0)"
          :selected-index="
            i &&
            selectedCardLocation === 'attached' &&
            selectedCard?.attached === extraZones[0]?.uid &&
            selectedCardIndex !== undefined
              ? selectedCardIndex + 1
              : undefined
          "
          :actions="zoneIsFree(0) ? getActions('zones', 0) : []"
          :hint="
            (viewer || zoneIsFree(0)) && extraZones[0]?.faceDown ? extraZones[0]?.name : undefined
          "
          :controls="!!getCard('zones', 0)"
          :counters="extraZones[0]?.counters"
          @action="(evt) => i && handleAction(evt, 'zones', 0)"
          @increment="(evt) => i && handleIncrement(evt, 'zones', 0)"
          @update="debouncedUpdateCardStats"
          :rotate
        />
        <!-- TOKENS -->
        <card-slot
          class=""
          :name="'Tokens'"
          :cards="getCards('tokens')"
          :hint="getCards('tokens').length"
          @click.right.prevent="iv && inspectCards('tokens')"
          @click.stop="i && (selectedCard ? logMoveCard('tokens') : drawCard('tokens'))"
          :selected-index="i && selectedCardLocation === 'tokens' && selectedCardIndex"
          :rotate
        />
        <!-- EXTRA 1 -->
        <card-slot
          :card="extraZones[1]"
          :cards="[
            extraZones[1],
            ...(getCards('attached').filter((c) => c?.attached === getCard('zones', 1)?.uid) ?? []),
          ]"
          :name="'Extra Monster Zone'"
          @click="i && zoneIsFree(1) && handleFieldClick(1, 'zones')"
          @click.right.prevent="
            (!extraZones[1]?.faceDown || zoneIsFree(1) || viewer) &&
            inspectCard(extraZones[1], 'zones')
          "
          class="bg-blue-800"
          :selected="isSelected('zones', 1)"
          :selected-index="
            i &&
            selectedCardLocation === 'attached' &&
            selectedCard?.attached === extraZones[1]?.uid &&
            selectedCardIndex !== undefined
              ? selectedCardIndex + 1
              : undefined
          "
          :actions="i && zoneIsFree(1) ? getActions('zones', 1) : []"
          :hint="
            (viewer || zoneIsFree(1)) && extraZones[1]?.faceDown ? extraZones[1]?.name : undefined
          "
          :controls="!!getCard('zones', 1)"
          :counters="extraZones[1]?.counters"
          @action="(evt) => handleAction(evt, 'zones', 1)"
          @increment="(evt) => i && handleIncrement(evt, 'zones', 1)"
          @update="debouncedUpdateCardStats"
          :rotate
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
          @click.stop="i && (selectedCard ? logMoveCard('banished') : selectCard('banished', 0))"
          @click.right.prevent="inspectCards('banished')"
          :hint="getCards('banished').length"
          :actions="i && selectedCard ? ['face-down', 'face-up'] : []"
          @action="(evt) => i && handleBanishedAction(evt)"
          :selected-index="i && selectedCardLocation === 'banished' && selectedCardIndex"
          :rotate
        />
      </template>

      <!-- TOP ROW -->
      <card-slot
        v-for="(card, index) in topRow"
        :key="index"
        :name="index ? 'Monster Card Zone' : 'Field Card Zone'"
        :card="card"
        :cards="[card, ...(getCards('attached').filter((c) => c?.attached === card?.uid) ?? [])]"
        :class="index === 0 ? 'bg-green-600' : 'bg-yellow-700'"
        @click.stop="i && handleFieldClick(index)"
        @click.right.prevent="(!card?.faceDown || iv) && inspectCard(card, 'field')"
        :selected="i && isSelected('field', index)"
        :selected-index="
          i &&
          selectedCardLocation === 'attached' &&
          selectedCard?.attached === card?.uid &&
          selectedCardIndex !== undefined
            ? selectedCardIndex + 1
            : undefined
        "
        :actions="i && getActions('field', index)"
        :hint="iv && card?.faceDown ? card?.name : undefined"
        :controls="i && !!card"
        :counters="card?.counters"
        @action="(evt) => i && handleAction(evt, 'field', index)"
        @increment="(evt) => i && handleIncrement(evt, 'field', index)"
        @update="debouncedUpdateCardStats"
        :rotate
      />
      <!-- GRAVEYARD -->
      <card-slot
        class="bg-gray-700"
        :cards="getCards('graveyard')"
        :name="'Graveyard'"
        :hint="getCards('graveyard').length"
        :selected-index="i && selectedCardLocation === 'graveyard' && selectedCardIndex"
        @click.stop="i && (selectedCard ? logMoveCard('graveyard') : selectCard('graveyard', 0))"
        @click.right.prevent="inspectCards('graveyard')"
        :rotate
      />
      <!-- EXTRA DECK -->
      <card-slot
        class="bg-violet-800"
        :cards="getCards('extra')"
        :name="'Extra Deck Zone'"
        :hint="getCards('extra').length"
        @click.right.prevent="iv && inspectCards('extra')"
        @click.stop="i && (selectedCard ? logMoveCard('extra') : inspectCards('extra'))"
        :selected-index="i && selectedCardLocation === 'extra' && selectedCardIndex"
        :rotate
      />
      <!-- BOTTOM ROW -->
      <card-slot
        v-for="[card, index] in bottomRow"
        :key="index"
        :card="card"
        :cards="[card, ...(getCards('attached').filter((c) => c?.attached === card?.uid) ?? [])]"
        :name="'Spell & Trap Card Zone'"
        class="bg-teal-600"
        @click.stop="i && handleFieldClick(index)"
        @click.right.prevent="(!card?.faceDown || iv) && inspectCard(card, 'field')"
        :selected="i && isSelected('field', index)"
        :selected-index="
          i &&
          selectedCardLocation === 'attached' &&
          selectedCard?.attached === card?.uid &&
          selectedCardIndex !== undefined
            ? selectedCardIndex + 1
            : undefined
        "
        :actions="i && getActions('field', index)"
        :hint="iv && card?.faceDown ? card?.name : undefined"
        :controls="i && !!card"
        :counters="card?.counters"
        @action="(evt) => i && handleAction(evt, 'field', index)"
        @increment="(evt) => i && handleIncrement(evt, 'field', index)"
        @update="debouncedUpdateCardStats"
        :rotate
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
        :rotate
      />
    </div>
    <div
      @click="i && logMoveCard('hand')"
      class="mt-4 flex h-[min(20vw,20vh)] w-full justify-center"
    >
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
          @click.stop="i && selectCard('hand', index)"
          @click.right.prevent="(iv || card?.revealed) && inspectCard(card, 'hand')"
          @dragstart.prevent=""
        >
          <div v-if="i" class="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-2">
            <IconButton title="Reveal" @click.stop="showToOpponent(index)">
              {{ getCard('hand', index)?.revealed ? 'visibility_off' : 'visibility' }}
            </IconButton>
            <IconButton title="Give" @click.stop="giveToOpponent(index)">
              volunteer_activism
            </IconButton>
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
        selectedCardLocation === inspectedCardsLocation ||
        ((selectedCardLocation === 'field' || selectedCardLocation === 'zones') &&
          inspectedCardsLocation === 'attached')
          ? selectedCardIndex
          : undefined
      "
      :card-index
      :controls="i && !hideInspectControls"
      @close="closeInspectModal"
      @select="selectInspectedCard"
      @draw="drawFromInspected"
      @reveal="revealCard"
      @flip="flipCard"
    />
  </div>
</template>
