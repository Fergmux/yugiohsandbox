<script setup lang="ts">
import type { Ref } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import { debounce, zip } from 'lodash'

import InspectModal from '@/components/InspectModal.vue'
import CardSlot from '@/components/play-space/CardSlot.vue'
import LifePoints from '@/components/play-space/LifePoints.vue'
import type { BoardSide, GameEdit, GameState, Player, YugiohCard } from '@/types/yugiohCard'
import { getS3ImageUrl } from '@/utils'

import IconButton from './IconButton.vue'

type CardLocation = keyof BoardSide | 'attached'

const props = defineProps<{
  gameState: GameState
  player: Player
  interactive?: boolean
  viewer?: boolean
  crawl?: boolean
}>()
const i = computed(() => props.interactive || undefined)
const iv = computed(() => i.value || props.viewer || undefined)
const hideInspectControls = ref(false)

const emit = defineEmits<{
  (e: 'edit', edits: GameEdit[], logText?: string): void
}>()

const gameState = computed(() => props.gameState)

const sendEdit = (edits: GameEdit[], logText?: string) => {
  emit('edit', edits, logText)
}

const revealCard = () => {
  sendEdit([], `revealed a card in ${zoneName(inspectedCardsLocation.value)}`)
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
  const card = findCardOnField(name)
  if (card) {
    sendEdit(
      [
        {
          type: 'update_card',
          player: props.player,
          cardUid: card.uid,
          location: findCardLocation(card.uid) ?? 'field',
          updates: { newAttack: card.newAttack, newDefence: card.newDefence },
        },
      ],
      `updated ${name}'s' ${stat}`,
    )
  }
}, 1000)

function findCardOnField(name: string): YugiohCard | undefined {
  for (const loc of ['field', 'zones'] as (keyof BoardSide)[]) {
    const found = cards.value[loc].find((c: YugiohCard | null) => c?.name === name)
    if (found) return found as YugiohCard
  }
  return undefined
}

function findCardLocation(uid: string): keyof BoardSide | undefined {
  for (const loc of [
    'field',
    'zones',
    'hand',
    'graveyard',
    'banished',
    'extra',
    'deck',
    'tokens',
    'attached',
  ] as (keyof BoardSide)[]) {
    if (cards.value[loc].some((c: YugiohCard | null) => c?.uid === uid)) return loc
  }
  return undefined
}

const extraZones = computed(() =>
  gameState.value.cards[props.player].zones.map((zone, index) =>
    zone === null ? gameState.value.cards[opponentPlayerKey.value].zones[index] : zone,
  ),
)

const updateLifePoints = (value: number, player: Player) => {
  const newValue = gameState.value.lifePoints[player] + value
  sendEdit([{ type: 'set_life_points', player, value: newValue }], `set their life points to ${newValue}`)
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
const bottomRow = computed(() => zip(getCards('field').slice(6), bottomRowIndexes) as [YugiohCard, number][])

const deckActions = computed(() =>
  selectedCard.value ? ['shuffle-in', 'place-top', 'place-bottom'] : ['shuffle', 'search'],
)

const zoneIsFree = (index: number) => opponentCards.value.zones[index] === null

// Selecting card
const selectedCard: Ref<YugiohCard | undefined> = ref()
const inspectedCard: Ref<YugiohCard | undefined> = ref()
const inspectedCardsLocation: Ref<CardLocation | undefined> = ref()
const inspectedCardsPlayerKey: Ref<Player | undefined> = ref()
const selectedCardLocation: Ref<CardLocation | undefined> = ref()
const selectedCardIndex: Ref<number | undefined> = ref()
const revealDeck = ref(false)

const cardIndex = computed(() => {
  const fieldIndex = getCards('field').findIndex(
    (c) => c?.uid === (Array.isArray(inspectedCards.value) ? inspectedCards.value[0]?.uid : inspectedCards.value?.uid),
  )

  const zoneIndex = getCards('zones').findIndex(
    (c) => c?.uid === (Array.isArray(inspectedCards.value) ? inspectedCards.value[0]?.uid : inspectedCards.value?.uid),
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
      const card = Array.isArray(inspectedCards.value) ? inspectedCards.value[0] : inspectedCards.value
      const fieldIndex = getCards('field').findIndex((c) => c?.uid === card?.uid)
      const index = fieldIndex === -1 ? getCards('zones').findIndex((c) => c?.uid === card?.uid) : fieldIndex
      const location = fieldIndex === -1 ? 'zones' : 'field'
      selectCard(location, index)
    } else {
      const card = Array.isArray(inspectedCards.value) ? inspectedCards.value[index] : inspectedCards.value
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
      let logText: string
      if (selectedCardLocation.value === 'field' || selectedCardLocation.value === 'zones') {
        logText = `moved ${cardName(selectedCard.value)} from ${zoneName(selectedCardLocation.value)} to ${zoneName(zone)}`
      } else {
        logText = `summoned ${selectedCard.value?.name} from ${zoneName(selectedCardLocation.value)}`
      }
      const edits = moveCard(zone, index)
      if (edits.length) sendEdit(edits, logText)
    }
  }
}

const inspectCard = (card: YugiohCard | null, location: keyof BoardSide | null) => {
  const attachedCards = getCards('attached').filter((c) => c?.attached === card?.uid) as YugiohCard[]
  inspectedCard.value = card ?? undefined
  inspectedCardsLocation.value = attachedCards.length ? 'attached' : (location ?? undefined)
}

const inspectCards = (location?: CardLocation, playerKey?: Player) => {
  if (!location) return
  inspectedCardsLocation.value = location ?? undefined
  inspectedCardsPlayerKey.value = playerKey ?? props.player
}

const inspectedCards = computed(() => {
  if (inspectedCard.value) {
    const attachedCards = getCards('attached').filter((c) => c?.attached === inspectedCard.value?.uid)
    return attachedCards.length && inspectedCard.value
      ? ([inspectedCard.value, ...attachedCards].filter(Boolean) as YugiohCard[])
      : inspectedCard.value
  }
  if (!inspectedCardsLocation.value || !inspectedCardsPlayerKey.value) return undefined
  const cardsToInspect = getCardData(inspectedCardsPlayerKey.value)[inspectedCardsLocation.value].filter(
    Boolean,
  ) as YugiohCard[]
  if (props.crawl && inspectedCardsLocation.value === 'deck' && revealDeck.value) {
    return cardsToInspect.sort(() => Math.random() - 0.5)
  } else {
    return cardsToInspect
  }
})

const showToOpponent = (index: number) => {
  const card = getCard('hand', index)
  if (!card) return
  sendEdit(
    [
      {
        type: 'update_card',
        player: props.player,
        cardUid: card.uid,
        location: 'hand',
        updates: { revealed: !card.revealed },
      },
    ],
    `revealed ${card.name}`,
  )
}
const giveToOpponent = (index: number) => {
  const card = getCard('hand', index)
  if (!card) return
  const cardData = { ...card, faceDown: false }
  sendEdit(
    [
      {
        type: 'transfer_card',
        fromPlayer: props.player,
        toPlayer: opponentPlayerKey.value,
        cardUid: card.uid,
        fromLocation: 'hand',
        toLocation: 'hand',
        cardData,
      },
    ],
    `gave ${card.name} to their opponent`,
  )
}

// Moving cards
const drawCard = (source: keyof BoardSide) => {
  if (!getCards(source).length) {
    if (props.crawl && source === 'deck') {
      const shuffled = [...getCards('graveyard')]
        .sort(() => Math.random() - 0.5)
        .map((c) => ({ ...c, faceDown: true }) as YugiohCard)
      sendEdit(
        [
          { type: 'set_zone', player: props.player, location: 'deck', cards: shuffled },
          { type: 'set_zone', player: props.player, location: 'graveyard', cards: [] },
        ],
        `moved their graveyard into deck`,
      )
      return
    } else {
      return
    }
  }
  const card = getCards(source)[0]
  if (!card) return
  const cardData = { ...card, faceDown: true }
  sendEdit(
    [
      {
        type: 'move_card',
        player: props.player,
        cardUid: card.uid,
        fromLocation: source,
        toLocation: 'hand',
        cardData,
      },
    ],
    `drew a card from ${zoneName(source)}`,
  )
}

const drawFromInspected = (destination: keyof BoardSide, index: number, faceDown?: boolean) => {
  const card = Array.isArray(inspectedCards.value) ? inspectedCards.value[index] : inspectedCards.value
  let newIndex = index
  if (inspectedCardsLocation.value === 'attached') {
    newIndex = getCards('attached').findIndex((c) => c?.uid === card?.uid)
  }

  selectCard(inspectedCardsLocation.value, newIndex)
  logMoveCard(destination, undefined, { faceDown })
  if (inspectedCardsLocation.value === 'attached') {
    inspectCard(Array.isArray(inspectedCards.value) ? inspectedCards.value[0] : (inspectedCards.value ?? null), 'field')
  } else {
    inspectCards(inspectedCardsLocation.value)
  }
}

const buildCardForDestination = (
  card: YugiohCard,
  destination: keyof BoardSide,
  currentLocation: keyof BoardSide,
  index?: number,
  options?: {
    faceDown?: boolean
    defence?: boolean
    newAttack?: number | null
    newDefence?: number | null
    attached?: string
  },
): YugiohCard => {
  const opts = { ...options }
  if (destination !== 'field' && destination !== 'zones') {
    opts.newAttack = null
    opts.newDefence = null
  }

  if (index !== undefined) {
    const target = getCard(destination, index)
    if (target === null) {
      const orientationOptions =
        currentLocation === 'field' || currentLocation === 'zones' ? {} : { faceDown: false, defence: false }
      return { ...card, ...orientationOptions, ...opts }
    }
    return { ...card, faceDown: true, defence: false, counters: 0, ...opts }
  }

  if (destination === 'deck' || destination === 'extra' || destination === 'tokens') {
    return { ...card, faceDown: true, defence: false, counters: 0, ...opts }
  }
  const orientationOptions = destination === 'banished' ? {} : { faceDown: false }
  return { ...card, defence: false, counters: 0, ...opts, ...orientationOptions }
}

const moveCard = (
  destination: keyof BoardSide,
  index?: number,
  options?: { faceDown?: boolean; defence?: boolean; attached?: string },
): GameEdit[] => {
  options = options ?? {}
  if (!selectedCardLocation.value || selectedCardIndex.value === undefined) return []
  const card = getCard(selectedCardLocation.value, selectedCardIndex.value)
  if (!card) return []

  if (destination === 'tokens' && card.type !== 'Token') return []
  if (card.type === 'Token' && !['tokens', 'field', 'hand'].includes(destination)) return []

  const edits: GameEdit[] = []
  const fromLocation = selectedCardLocation.value as keyof BoardSide

  const attachedCards = getCards('attached').filter((c) => c?.attached === card?.uid) as YugiohCard[]
  if (destination !== 'field' && destination !== 'zones' && attachedCards.length) {
    attachedCards.forEach((c) => {
      const attachedCardData = buildCardForDestination(c, destination, 'attached', undefined, options)
      edits.push({
        type: 'move_card',
        player: props.player,
        cardUid: c.uid,
        fromLocation: 'attached',
        toLocation: destination,
        cardData: attachedCardData,
      })
    })
  }

  const cardData = buildCardForDestination(card, destination, fromLocation, index, options)
  edits.push({
    type: 'move_card',
    player: props.player,
    cardUid: card.uid,
    fromLocation,
    toLocation: destination,
    toIndex: index,
    cardData,
  })

  resetSelectedCard()
  return edits
}

const logMoveCard = (
  destination: keyof BoardSide,
  index?: number,
  options?: { faceDown?: boolean; defence?: boolean },
) => {
  options = options ?? {}
  if (!selectedCard.value || !selectedCardLocation.value) return
  const logText = `moved ${destination === 'graveyard' ? selectedCard.value.name : cardName(selectedCard.value)} from ${zoneName(selectedCardLocation.value)} to ${zoneName(destination)}`
  const edits = moveCard(destination, index, options)
  if (edits.length) sendEdit(edits, logText)
}

const flipCard = (card: YugiohCard) => {
  const location = findCardLocation(card.uid) ?? 'field'
  sendEdit(
    [
      {
        type: 'update_card',
        player: props.player,
        cardUid: card.uid,
        location,
        updates: { faceDown: !card.faceDown },
      },
    ],
    `flipped ${card.name} ${!card.faceDown ? 'face down' : 'face up'}`,
  )
}

const handleAction = (action: string, destination: keyof BoardSide, index: number) => {
  switch (action) {
    case 'set': {
      const defence = selectedCard.value?.type !== 'Trap Card' && selectedCard.value?.type !== 'Spell Card'
      const logText = `set ${cardName(selectedCard.value)} face down`
      const edits = moveCard(destination, index, { faceDown: true, defence })
      if (edits.length) sendEdit(edits, logText)
      break
    }
    case 'defence': {
      const logText = `summoned ${selectedCard.value?.name} in defence mode`
      const edits = moveCard(destination, index, { defence: true })
      if (edits.length) sendEdit(edits, logText)
      break
    }
    case 'flip': {
      const cardToFlip = getCard(destination, index)
      if (!cardToFlip) return
      flipCard(cardToFlip)
      break
    }
    case 'position': {
      const cardToChange = getCard(destination, index)
      if (!cardToChange) return
      const newDefence = !cardToChange.defence
      sendEdit(
        [
          {
            type: 'update_card',
            player: props.player,
            cardUid: cardToChange.uid,
            location: destination,
            updates: { defence: newDefence },
          },
        ],
        `changed ${cardName(cardToChange)} to ${newDefence ? 'defence' : 'attack'} mode`,
      )
      break
    }
    case 'attach': {
      if (!selectedCard.value) return
      const cardsAttachedToSelected = getCards('attached').filter((c) => c?.attached === selectedCard.value?.uid)
      const destinationCard = getCard(destination, index)
      const destinationCardUid = destinationCard?.uid
      const attachEdits: GameEdit[] = []

      if (cardsAttachedToSelected.length) {
        cardsAttachedToSelected.forEach((c) => {
          if (c) {
            attachEdits.push({
              type: 'update_card',
              player: props.player,
              cardUid: c.uid,
              location: 'attached',
              updates: { attached: destinationCardUid },
            })
          }
        })
      }
      const logText = `attached ${selectedCard.value?.name} to ${destinationCard?.name}`
      const moveEdits = moveCard('attached', undefined, { faceDown: false, attached: destinationCardUid })
      if (moveEdits.length) sendEdit([...attachEdits, ...moveEdits], logText)
      break
    }
  }
}

const handleDeckAction = (action: string) => {
  const options = { faceDown: true, defence: false }
  switch (action) {
    case 'shuffle-in': {
      if (!selectedCard.value) return
      const randomIndex = Math.floor(Math.random() * (getCards('deck').length + 1))
      const logText = `shuffled ${cardName(selectedCard.value)} into their deck`
      const edits = moveCard('deck', randomIndex, options)
      if (edits.length) sendEdit(edits, logText)
      break
    }
    case 'place-top': {
      if (!selectedCard.value) return
      const logText = `placed ${cardName(selectedCard.value)} on top of their deck`
      const edits = moveCard('deck', 0, options)
      if (edits.length) sendEdit(edits, logText)
      break
    }
    case 'place-bottom': {
      if (!selectedCard.value) return
      const logText = `placed ${cardName(selectedCard.value)} on the bottom of their deck`
      const edits = moveCard('deck', getCards('deck').length, options)
      if (edits.length) sendEdit(edits, logText)
      break
    }
    case 'shuffle': {
      const shuffled = [...getCards('deck')].sort(() => Math.random() - 0.5)
      sendEdit([{ type: 'set_zone', player: props.player, location: 'deck', cards: shuffled }], `shuffled their deck`)
      break
    }
    case 'search': {
      revealDeck.value = true
      inspectCards('deck')
      sendEdit([], `searched their deck`)
      break
    }
  }
}

const handleBanishedAction = (action: string) => {
  switch (action) {
    case 'face-down': {
      if (!selectedCard.value) return
      const logText = `banished ${cardName(selectedCard.value)} face down`
      const edits = moveCard('banished', 0, { faceDown: true })
      if (edits.length) sendEdit(edits, logText)
      break
    }
    case 'face-up': {
      if (!selectedCard.value) return
      const logText = `banished ${selectedCard.value?.name} face up`
      const edits = moveCard('banished', 0, { faceDown: false })
      if (edits.length) sendEdit(edits, logText)
      break
    }
  }
}

const handleIncrement = (count: number, location: keyof BoardSide, index: number) => {
  const card = getCard(location, index)
  if (!card) return
  const newCount = Math.max(0, (card.counters || 0) + count)
  sendEdit([
    {
      type: 'update_card',
      player: props.player,
      cardUid: card.uid,
      location,
      updates: { counters: newCount },
    },
  ])
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
    ...getCards('attached'),
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
          @click.right.prevent="(hideInspectControls = true) && inspectCards('banished', opponentPlayerKey)"
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
            (!extraZones[0]?.faceDown || zoneIsFree(0) || viewer) && inspectCard(extraZones[0], 'zones')
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
          :hint="(viewer || zoneIsFree(0)) && extraZones[0]?.faceDown ? extraZones[0]?.name : undefined"
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
            (!extraZones[1]?.faceDown || zoneIsFree(1) || viewer) && inspectCard(extraZones[1], 'zones')
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
          :hint="(viewer || zoneIsFree(1)) && extraZones[1]?.faceDown ? extraZones[1]?.name : undefined"
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
    <div @click="i && logMoveCard('hand')" class="mt-4 flex h-[min(20vw,20vh)] w-full justify-center">
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
            <IconButton title="Give" @click.stop="giveToOpponent(index)"> volunteer_activism </IconButton>
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
