<script setup lang="ts">
import type { Ref } from 'vue'
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'

import { debounce, zip } from 'lodash'

import InspectModal from '@/components/InspectModal.vue'
import CardSlot from '@/components/play-space/CardSlot.vue'
import LifePoints from '@/components/play-space/LifePoints.vue'
import { useCardInspection } from '@/composables/useCardInspection'
import { useCardMovement } from '@/composables/useCardMovement'
import { type DragData, type DropZone, useDragDrop } from '@/composables/useDragDrop'
import { useFieldShortcuts } from '@/composables/useFieldShortcuts'
import type { CardSelection } from '@/types/crawl'
import { mainDeckMonsterTypes, spellTrapTypes } from '@/types/filters'
import type { BoardSide, GameEdit, GameState, Player, YugiohCard } from '@/types/yugiohCard'
import { getS3ImageUrl } from '@/utils'

import HandCard from './HandCard.vue'

type CardLocation = keyof BoardSide | 'attached'

// ── Props & emits ───────────────────────────────────────────────────────────

const props = defineProps<{
  gameState: GameState
  player: Player
  interactive?: boolean
  rotate?: boolean
  viewer?: boolean
  crawl?: boolean
  opponentSelectedCard?: CardSelection
  mySelectedOpponentCard?: CardSelection
}>()

const emit = defineEmits<{
  (e: 'edit', edits: GameEdit[], logText?: string): void
  (e: 'selectOpponentCard', location: keyof BoardSide, index: number): void
  (e: 'cardSelected'): void
  (e: 'useActionPoint'): void
}>()

// ── Derived state ───────────────────────────────────────────────────────────

const isInteractive = computed(() => props.interactive || undefined)
const canView = computed(() => isInteractive.value || props.viewer || undefined)
const isCrawl = computed(() => !!props.crawl)
const rotate = computed(() => props.rotate)

const gameState = computed(() => props.gameState)
const playerKey = computed(() => props.player)
const opponentPlayerKey = computed(() => (props.player === 'player1' ? 'player2' : 'player1'))

// ── Card data accessors ─────────────────────────────────────────────────────

const getCardData = (key: Player) => gameState.value.cards[key]
const cards = computed(() => getCardData(props.player))
const opponentCards = computed(() => getCardData(opponentPlayerKey.value))
const getCards = (location: keyof BoardSide) => cards.value[location]
const getCard = (location: keyof BoardSide, index: number) => getCards(location)[index]

const extraZones = computed(() =>
  gameState.value.cards[props.player].zones.map((zone, index) =>
    zone === null ? gameState.value.cards[opponentPlayerKey.value].zones[index] : zone,
  ),
)

// ── Field layout ────────────────────────────────────────────────────────────

const topRow = computed(() => getCards('field').slice(0, 6))

const bottomRowIndices = Array(5)
  .fill(0)
  .map((_, i) => i + 6)
const bottomRow = computed(() => zip(getCards('field').slice(6), bottomRowIndices) as [YugiohCard, number][])

// ── Edit helpers ────────────────────────────────────────────────────────────

const sendEdit = (edits: GameEdit[], logText?: string) => {
  emit('edit', edits, logText)
}

const updateLifePoints = (value: number, player: Player) => {
  const newValue = gameState.value.lifePoints[player] + value
  sendEdit([{ type: 'set_life_points', player, value: newValue }], `set their life points to ${newValue}`)
}

// ── Card selection ──────────────────────────────────────────────────────────

const selectedCard: Ref<YugiohCard | undefined> = ref()
const selectedCardLocation: Ref<CardLocation | undefined> = ref()
const selectedCardIndex: Ref<number | undefined> = ref()

const isSelected = (location: keyof BoardSide, index: number) =>
  selectedCardLocation.value === location && selectedCardIndex.value === index

const selectCard = (location?: CardLocation, index?: number) => {
  if (location == null || index == null) return
  if (selectedCardLocation.value === location && selectedCardIndex.value === index) {
    resetSelectedCard()
  } else {
    selectedCard.value = getCard(location, index) ?? undefined
    selectedCardLocation.value = location
    selectedCardIndex.value = index
    emit('cardSelected')
  }
}

const resetSelectedCard = () => {
  selectedCard.value = undefined
  selectedCardLocation.value = undefined
  selectedCardIndex.value = undefined
}

defineExpose({ resetSelectedCard })

const isOpponentSelected = (location: keyof BoardSide, index: number) =>
  props.opponentSelectedCard?.location === location && props.opponentSelectedCard?.index === index

const isMyOpponentSelected = (location: keyof BoardSide, index: number) =>
  props.mySelectedOpponentCard?.location === location && props.mySelectedOpponentCard?.index === index

const handleOpponentCardClick = (location: keyof BoardSide, index: number) => {
  const card = getCard(location, index)
  if (!card) return
  emit('selectOpponentCard', location, index)
}

// ── Card movement composable ────────────────────────────────────────────────

const {
  cardName,
  zoneName,
  findCardOnField,
  findCardLocation,
  findMiddleFreeSlot,
  moveCard: _moveCard,
  logMoveCard,
  flipCard,
  drawCard,
} = useCardMovement({
  player: playerKey,
  getCards,
  getCard,
  sendEdit,
  selectedCard,
  selectedCardLocation,
  selectedCardIndex,
  resetSelectedCard,
  isCrawl,
})

const moveCard = (
  destination: keyof BoardSide,
  index?: number,
  options?: { faceDown?: boolean; defence?: boolean; attached?: string },
): GameEdit[] => {
  if (selectedCardLocation.value === 'hand' && (destination === 'field' || destination === 'zones')) {
    emit('useActionPoint')
  }
  return _moveCard(destination, index, options)
}

// ── Card inspection composable ──────────────────────────────────────────────

const {
  inspectedCardsList,
  inspectedCardsLocation,
  inspectedFieldIndex,
  visibleCards,
  revealDeck,
  hideInspectControls,
  inspectCard,
  inspectCards,
  closeInspectModal,
} = useCardInspection({
  player: playerKey,
  getCards,
  getCardData,
  extraZones,
  isCrawl,
})

const selectInspectedCard = (index: number) => {
  if (inspectedCardsLocation.value === 'attached') {
    if (index === 0) {
      // First card is the parent monster — find it on the field
      const card = Array.isArray(inspectedCardsList.value) ? inspectedCardsList.value[0] : inspectedCardsList.value
      const fieldIndex = getCards('field').findIndex((c) => c?.uid === card?.uid)
      const zoneIndex = fieldIndex === -1 ? getCards('zones').findIndex((c) => c?.uid === card?.uid) : fieldIndex
      const location = fieldIndex === -1 ? 'zones' : 'field'
      selectCard(location, zoneIndex)
    } else {
      // Selecting an attached card
      const card = Array.isArray(inspectedCardsList.value) ? inspectedCardsList.value[index] : inspectedCardsList.value
      selectCard(
        'attached',
        getCards('attached').findIndex((c) => c?.uid === card?.uid),
      )
    }
  } else {
    selectCard(inspectedCardsLocation.value, index)
  }
}

const drawFromInspected = (destination: keyof BoardSide, index: number, faceDown?: boolean) => {
  const card = Array.isArray(inspectedCardsList.value) ? inspectedCardsList.value[index] : inspectedCardsList.value
  let resolvedIndex = index
  if (inspectedCardsLocation.value === 'attached') {
    resolvedIndex = getCards('attached').findIndex((c) => c?.uid === card?.uid)
  }

  selectCard(inspectedCardsLocation.value, resolvedIndex)
  logMoveCard(destination, undefined, { faceDown })

  // Refresh inspection after drawing
  if (inspectedCardsLocation.value === 'attached') {
    inspectCard(
      Array.isArray(inspectedCardsList.value) ? inspectedCardsList.value[0] : (inspectedCardsList.value ?? null),
      'field',
    )
  } else {
    inspectCards(inspectedCardsLocation.value)
  }
}

const revealCard = () => {
  if (props.viewer) return
  sendEdit([], `revealed a card in ${zoneName(inspectedCardsLocation.value)}`)
}

// ── Stat updates ────────────────────────────────────────────────────────────

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

// ── Field slot helpers ──────────────────────────────────────────────────────

const getActions = (location: keyof BoardSide, index: number) => {
  const targetCard = getCard(location, index)
  if (selectedCard.value) {
    const attach = targetCard?.uid !== selectedCard.value?.uid ? ['attach'] : []
    const actions = index < 6 && index > 0 ? ['set', 'defence'] : ['set']
    return targetCard ? attach : actions
  } else {
    const actions = index < 6 && index > 0 ? ['flip', 'position'] : ['flip']
    return targetCard ? actions : []
  }
}

const deckActions = computed(() =>
  selectedCard.value ? ['shuffle-in', 'place-top', 'place-bottom'] : ['shuffle', 'search'],
)

const zoneIsFree = (index: number) => opponentCards.value.zones[index] === null

// ── Field click handlers ────────────────────────────────────────────────────

const handleFieldClick = (index: number, zone: 'zones' | 'field' = 'field') => {
  const card = getCard(zone, index)
  if (card) {
    if (isShiftHeld.value) {
      selectCard(zone, index)
      logMoveCard('graveyard')
    } else {
      selectCard(zone, index)
    }
  } else if (selectedCard.value) {
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

const shiftRightClickFieldCard = (index: number) => {
  if (index === 0) return
  const card = getCard('field', index)
  if (!card) return

  if (spellTrapTypes.includes(card.type) || card.faceDown) {
    flipCard(card)
  } else {
    const newDefence = !card.defence
    sendEdit(
      [
        {
          type: 'update_card',
          player: props.player,
          cardUid: card.uid,
          location: 'field',
          updates: { defence: newDefence },
        },
      ],
      `changed ${cardName(card)} to ${newDefence ? 'defence' : 'attack'} mode`,
    )
  }
}

// ── Hand quick-play handlers (shift+click shortcuts) ────────────────────────

const shiftClickHandCard = (index: number) => {
  const card = getCard('hand', index)
  if (!card) return

  if (card.race === 'Field') {
    if (getCard('field', 0) !== null) return
    selectCard('hand', index)
    const edits = moveCard('field', 0, { faceDown: false })
    if (edits.length) sendEdit(edits, `played ${card.name}`)
  } else if (spellTrapTypes.includes(card.type)) {
    const freeIndex = findMiddleFreeSlot([6, 7, 8, 9, 10])
    if (freeIndex === -1) return
    selectCard('hand', index)
    const edits = moveCard('field', freeIndex, { faceDown: false })
    if (edits.length) sendEdit(edits, `played ${card.name}`)
  } else if (mainDeckMonsterTypes.includes(card.type)) {
    const freeIndex = findMiddleFreeSlot([1, 2, 3, 4, 5])
    if (freeIndex === -1) return
    selectCard('hand', index)
    const edits = moveCard('field', freeIndex)
    if (edits.length) sendEdit(edits, `summoned ${card.name}`)
  }
}

const shiftRightClickHandCard = (index: number) => {
  const card = getCard('hand', index)
  if (!card || card.race === 'Field') return

  if (mainDeckMonsterTypes.includes(card.type)) {
    const freeIndex = findMiddleFreeSlot([1, 2, 3, 4, 5])
    if (freeIndex === -1) return
    selectCard('hand', index)
    const edits = moveCard('field', freeIndex, { faceDown: true, defence: true })
    if (edits.length) sendEdit(edits, `set ${card.name} face down`)
  } else if (spellTrapTypes.includes(card.type)) {
    const freeIndex = findMiddleFreeSlot([6, 7, 8, 9, 10])
    if (freeIndex === -1) return
    selectCard('hand', index)
    const edits = moveCard('field', freeIndex, { faceDown: true })
    if (edits.length) sendEdit(edits, `set ${card.name} face down`)
  }
}

// ── Action dispatchers ──────────────────────────────────────────────────────

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
      if (cardToFlip) flipCard(cardToFlip)
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
      const destinationCard = getCard(destination, index)
      const destinationCardUid = destinationCard?.uid
      const attachEdits: GameEdit[] = []

      // Re-parent any cards attached to the selected card
      const cardsAttachedToSelected = getCards('attached').filter((c) => c?.attached === selectedCard.value?.uid)
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

      const logText = `attached ${selectedCard.value?.name} to ${destinationCard?.name}`
      const moveEdits = moveCard('attached', undefined, {
        faceDown: false,
        attached: destinationCardUid,
      })
      if (moveEdits.length) sendEdit([...attachEdits, ...moveEdits], logText)
      break
    }
  }
}

const handleDeckAction = (action: string) => {
  const faceDownOptions = { faceDown: true, defence: false }

  switch (action) {
    case 'shuffle-in': {
      if (!selectedCard.value) return
      const randomIndex = Math.floor(Math.random() * (getCards('deck').length + 1))
      const logText = `shuffled ${cardName(selectedCard.value)} into their deck`
      const edits = moveCard('deck', randomIndex, faceDownOptions)
      if (edits.length) sendEdit(edits, logText)
      break
    }
    case 'place-top': {
      if (!selectedCard.value) return
      const logText = `placed ${cardName(selectedCard.value)} on top of their deck`
      const edits = moveCard('deck', 0, faceDownOptions)
      if (edits.length) sendEdit(edits, logText)
      break
    }
    case 'place-bottom': {
      if (!selectedCard.value) return
      const logText = `placed ${cardName(selectedCard.value)} on the bottom of their deck`
      const edits = moveCard('deck', getCards('deck').length, faceDownOptions)
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

const handleDeckRightClick = () => {
  if (props.viewer) {
    revealDeck.value = true
    inspectCards('deck')
  } else {
    inspectCards('deck')
  }
}

const handleBanishedAction = (action: string) => {
  if (action === 'face-down' && selectedCard.value) {
    const logText = `banished ${cardName(selectedCard.value)} face down`
    const edits = moveCard('banished', 0, { faceDown: true })
    if (edits.length) sendEdit(edits, logText)
  }
}

// ── Hand card actions ───────────────────────────────────────────────────────

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

const giveToOpponent = (location: CardLocation, index: number) => {
  const card = getCard(location, index)
  if (!card) return
  sendEdit(
    [
      {
        type: 'transfer_card',
        fromPlayer: props.player,
        toPlayer: opponentPlayerKey.value,
        cardUid: card.uid,
        fromLocation: location,
        toLocation: 'hand',
        cardData: { ...card, faceDown: false },
      },
    ],
    `gave ${card.name} to their opponent`,
  )
}

// ── Keyboard shortcuts ──────────────────────────────────────────────────────

const { isShiftHeld, registerShortcut } = useFieldShortcuts()

const playerLpRef = ref<{ focus: () => void }>()
const opponentLpRef = ref<{ focus: () => void }>()

registerShortcut('l', () => isInteractive.value && playerLpRef.value?.focus())
registerShortcut('o', () => isInteractive.value && opponentLpRef.value?.focus())

registerShortcut('g', () => {
  if (!isInteractive.value) return
  if (selectedCard.value) {
    logMoveCard('graveyard')
  } else {
    inspectCards('graveyard')
  }
})
registerShortcut('h', () => {
  if (!isInteractive.value || !selectedCard.value) return
  logMoveCard('hand')
})
registerShortcut('b', () => {
  if (!isInteractive.value || !selectedCard.value) return
  logMoveCard('banished')
})
registerShortcut('f', () => {
  if (!isInteractive.value || !selectedCard.value) return
  if (getCard('field', 0) !== null) return
  logMoveCard('field', 0)
})
registerShortcut('d', () => {
  if (!isInteractive.value || selectedCard.value) return
  drawCard('deck')
})
registerShortcut('s', () => {
  if (!isInteractive.value || selectedCard.value) return
  handleDeckAction('search')
})
registerShortcut('p', () => {
  if (!isInteractive.value || !selectedCard.value) return
  if (selectedCardLocation.value === undefined || selectedCardIndex.value === undefined) return
  giveToOpponent(selectedCardLocation.value, selectedCardIndex.value)
})

// Escape to deselect
onMounted(() => window.addEventListener('keyup', handleKeyUp, true))
onBeforeUnmount(() => window.removeEventListener('keyup', handleKeyUp, true))

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && !inspectedCardsList.value) {
    resetSelectedCard()
  }
}

// ── Drag and drop ───────────────────────────────────────────────────────────

const fieldRef = ref<HTMLElement>()

const handleDrop = (drag: DragData, drop: DropZone) => {
  if (drag.sourceLocation === drop.location && (drop.index === undefined || drag.sourceIndex === drop.index)) return

  const card = getCard(drag.sourceLocation, drag.sourceIndex)
  if (!card || card.uid !== drag.card.uid) return

  // Set selection to the dragged card for moveCard to use
  selectedCard.value = card
  selectedCardLocation.value = drag.sourceLocation
  selectedCardIndex.value = drag.sourceIndex

  switch (drop.location) {
    case 'field':
    case 'zones': {
      if (drop.index === undefined) return
      const targetCard = getCard(drop.location, drop.index)
      if (targetCard && targetCard.uid !== card.uid) {
        handleAction('attach', drop.location, drop.index)
      } else if (!targetCard) {
        const logText =
          drag.sourceLocation === 'field' || drag.sourceLocation === 'zones'
            ? `moved ${cardName(card)} from ${zoneName(drag.sourceLocation)} to ${zoneName(drop.location)}`
            : `summoned ${card.name} from ${zoneName(drag.sourceLocation)}`
        const edits = moveCard(drop.location, drop.index)
        if (edits.length) sendEdit(edits, logText)
      }
      break
    }
    case 'graveyard':
    case 'banished':
    case 'hand':
    case 'extra':
    case 'tokens':
      logMoveCard(drop.location)
      break
    case 'deck':
      handleDeckAction('place-top')
      break
  }
}

const { dragging, dragX, dragY, hoverZone, didDrag, startDrag } = useDragDrop(handleDrop)

const startCardDrag = (card: YugiohCard, location: keyof BoardSide, index: number, event: PointerEvent) => {
  const showFace = location === 'hand' || !card.faceDown
  startDrag(
    {
      card,
      sourceLocation: location,
      sourceIndex: index,
      imageUrl: getS3ImageUrl(showFace ? card.id : 0),
    },
    event,
  )
}

provide('dragHoverZone', hoverZone)
provide(
  'isDragActive',
  computed(() => !!dragging.value),
)
provide(
  'draggingCardUid',
  computed(() => dragging.value?.card.uid),
)

// Suppress click events that fire immediately after a drag ends
const suppressClickAfterDrag = (e: MouseEvent) => {
  if (didDrag.value) {
    e.stopPropagation()
    e.preventDefault()
  }
}

onMounted(() => fieldRef.value?.addEventListener('click', suppressClickAfterDrag, true))
onBeforeUnmount(() => fieldRef.value?.removeEventListener('click', suppressClickAfterDrag, true))

// ── Extra zone helpers ──────────────────────────────────────────────────────

const extraZoneCards = (zoneIndex: number) => [
  extraZones.value[zoneIndex],
  ...(getCards('attached').filter((c) => c?.attached === getCard('zones', zoneIndex)?.uid) ?? []),
]

const attachedSelectedIndex = (parentUid?: string) =>
  isInteractive.value &&
  selectedCardLocation.value === 'attached' &&
  selectedCard.value?.attached === parentUid &&
  selectedCardIndex.value !== undefined
    ? selectedCardIndex.value + 1
    : undefined
</script>

<template>
  <div class="select-none" ref="fieldRef">
    <div class="grid grid-cols-7 gap-2">
      <!-- ── Banished / Life Points / Extra Zones / Tokens row ─────────── -->
      <template v-if="isInteractive || (viewer && props.player === 'player1')">
        <!-- Opponent banished -->
        <card-slot
          class="bg-gray-200"
          name="Banished Zone"
          :cards="opponentCards.banished"
          :hint="opponentCards.banished.length"
          @click.right.prevent="(hideInspectControls = true) && inspectCards('banished', opponentPlayerKey)"
          :rotate
        />

        <!-- Opponent life points -->
        <life-points
          ref="opponentLpRef"
          :life-points="gameState.lifePoints[opponentPlayerKey]"
          :interactive="isInteractive"
          @update="updateLifePoints($event, opponentPlayerKey)"
        />

        <!-- Extra monster zone (left) / Tokens / Extra monster zone (right) -->
        <card-slot
          :card="extraZones[0]"
          :cards="extraZoneCards(0)"
          name="Extra Monster Zone"
          class="bg-blue-800"
          :selected="isSelected('zones', 0)"
          :selected-index="attachedSelectedIndex(extraZones[0]?.uid)"
          :actions="isInteractive && zoneIsFree(0) ? getActions('zones', 0) : []"
          :hint="(viewer || zoneIsFree(0)) && extraZones[0]?.faceDown ? extraZones[0]?.name : undefined"
          :controls="!!getCard('zones', 0)"
          :counters="extraZones[0]?.counters"
          :opponent-selected="isOpponentSelected('zones', 0) || isMyOpponentSelected('zones', 0)"
          :rotate
          :drop-zone="isInteractive && zoneIsFree(0) ? 'zones' : undefined"
          :drop-index="isInteractive && zoneIsFree(0) ? 0 : undefined"
          @click="isInteractive ? zoneIsFree(0) && handleFieldClick(0, 'zones') : handleOpponentCardClick('zones', 0)"
          @click.right.prevent="
            (!extraZones[0]?.faceDown || zoneIsFree(0) || viewer) && inspectCard(extraZones[0], 'zones')
          "
          @action="(evt) => isInteractive && handleAction(evt, 'zones', 0)"
          @increment="(evt) => isInteractive && handleIncrement(evt, 'zones', 0)"
          @update="debouncedUpdateCardStats"
          @pointerdown="isInteractive && getCard('zones', 0) && startCardDrag(getCard('zones', 0)!, 'zones', 0, $event)"
        />

        <card-slot
          name="Tokens"
          :cards="getCards('tokens')"
          :hint="getCards('tokens').length"
          :selected-index="isInteractive && selectedCardLocation === 'tokens' && selectedCardIndex"
          :rotate
          :drop-zone="isInteractive ? 'tokens' : undefined"
          @click.right.prevent="canView && inspectCards('tokens')"
          @click.stop="isInteractive && (selectedCard ? logMoveCard('tokens') : drawCard('tokens'))"
        />

        <card-slot
          :card="extraZones[1]"
          :cards="extraZoneCards(1)"
          name="Extra Monster Zone"
          class="bg-blue-800"
          :selected="isSelected('zones', 1)"
          :selected-index="attachedSelectedIndex(extraZones[1]?.uid)"
          :actions="isInteractive && zoneIsFree(1) ? getActions('zones', 1) : []"
          :hint="(viewer || zoneIsFree(1)) && extraZones[1]?.faceDown ? extraZones[1]?.name : undefined"
          :controls="!!getCard('zones', 1)"
          :counters="extraZones[1]?.counters"
          :opponent-selected="isOpponentSelected('zones', 1) || isMyOpponentSelected('zones', 1)"
          :rotate
          :drop-zone="isInteractive && zoneIsFree(1) ? 'zones' : undefined"
          :drop-index="isInteractive && zoneIsFree(1) ? 1 : undefined"
          @click="isInteractive ? zoneIsFree(1) && handleFieldClick(1, 'zones') : handleOpponentCardClick('zones', 1)"
          @click.right.prevent="
            (!extraZones[1]?.faceDown || zoneIsFree(1) || viewer) && inspectCard(extraZones[1], 'zones')
          "
          @action="(evt) => isInteractive && handleAction(evt, 'zones', 1)"
          @increment="(evt) => isInteractive && handleIncrement(evt, 'zones', 1)"
          @update="debouncedUpdateCardStats"
          @pointerdown="isInteractive && getCard('zones', 1) && startCardDrag(getCard('zones', 1)!, 'zones', 1, $event)"
        />

        <!-- Player life points -->
        <life-points
          ref="playerLpRef"
          :life-points="gameState.lifePoints[props.player]"
          :interactive="isInteractive"
          reverse
          @update="updateLifePoints($event, props.player)"
        />

        <!-- Player banished -->
        <card-slot
          class="bg-gray-200"
          name="Banished Zone"
          :cards="getCards('banished')"
          :hint="getCards('banished').length"
          :actions="isInteractive && selectedCard ? ['face-down'] : []"
          :selected-index="isInteractive && selectedCardLocation === 'banished' && selectedCardIndex"
          :opponent-selected="isOpponentSelected('banished', 0) || isMyOpponentSelected('banished', 0)"
          :rotate
          :drop-zone="isInteractive ? 'banished' : undefined"
          @click.stop="
            isInteractive
              ? selectedCard
                ? logMoveCard('banished')
                : selectCard('banished', 0)
              : handleOpponentCardClick('banished', 0)
          "
          @click.right.prevent="inspectCards('banished')"
          @action="(evt) => isInteractive && handleBanishedAction(evt)"
          @pointerdown="
            isInteractive &&
            getCards('banished').length &&
            startCardDrag(getCards('banished')[0]!, 'banished', 0, $event)
          "
        />
      </template>

      <!-- ── Top row: field spell + 5 monster zones ────────────────────── -->
      <card-slot
        v-for="(card, index) in topRow"
        :key="index"
        :name="index ? 'Monster Card Zone' : 'Field Card Zone'"
        :card="card"
        :cards="[card, ...(getCards('attached').filter((c) => c?.attached === card?.uid) ?? [])]"
        :class="index === 0 ? 'bg-green-600' : 'bg-yellow-700'"
        :selected="isInteractive && isSelected('field', index)"
        :selected-index="attachedSelectedIndex(card?.uid)"
        :actions="isInteractive && getActions('field', index)"
        :hint="canView && card?.faceDown ? card?.name : undefined"
        :controls="isInteractive && !!card"
        :counters="card?.counters"
        :opponent-selected="isOpponentSelected('field', index) || isMyOpponentSelected('field', index)"
        :rotate
        :drop-zone="isInteractive ? 'field' : undefined"
        :drop-index="isInteractive ? index : undefined"
        @click.stop="isInteractive ? handleFieldClick(index) : handleOpponentCardClick('field', index)"
        @click.right.prevent="
          isInteractive && isShiftHeld && index !== 0
            ? shiftRightClickFieldCard(index)
            : (!card?.faceDown || canView) && inspectCard(card, 'field')
        "
        @action="(evt) => isInteractive && handleAction(evt, 'field', index)"
        @increment="(evt) => isInteractive && handleIncrement(evt, 'field', index)"
        @update="debouncedUpdateCardStats"
        @pointerdown="isInteractive && card && startCardDrag(card, 'field', index, $event)"
      />

      <!-- Graveyard -->
      <card-slot
        class="bg-gray-700"
        name="Graveyard"
        :cards="getCards('graveyard')"
        :hint="getCards('graveyard').length"
        :selected-index="isInteractive && selectedCardLocation === 'graveyard' && selectedCardIndex"
        :opponent-selected="isOpponentSelected('graveyard', 0) || isMyOpponentSelected('graveyard', 0)"
        :rotate
        :drop-zone="isInteractive ? 'graveyard' : undefined"
        @click.stop="
          isInteractive
            ? selectedCard
              ? logMoveCard('graveyard')
              : selectCard('graveyard', 0)
            : handleOpponentCardClick('graveyard', 0)
        "
        @click.right.prevent="inspectCards('graveyard')"
      />

      <!-- Extra deck -->
      <card-slot
        class="bg-violet-800"
        name="Extra Deck Zone"
        :cards="getCards('extra')"
        :hint="getCards('extra').length"
        :selected-index="isInteractive && selectedCardLocation === 'extra' && selectedCardIndex"
        :rotate
        :drop-zone="isInteractive ? 'extra' : undefined"
        @click.right.prevent="canView && inspectCards('extra')"
        @click.stop="isInteractive && (selectedCard ? logMoveCard('extra') : inspectCards('extra'))"
      />

      <!-- ── Bottom row: 5 spell/trap zones ────────────────────────────── -->
      <card-slot
        v-for="[card, index] in bottomRow"
        :key="index"
        :card="card"
        :cards="[card, ...(getCards('attached').filter((c) => c?.attached === card?.uid) ?? [])]"
        name="Spell & Trap Card Zone"
        class="bg-teal-600"
        :selected="isInteractive && isSelected('field', index)"
        :selected-index="attachedSelectedIndex(card?.uid)"
        :actions="isInteractive && getActions('field', index)"
        :hint="canView && card?.faceDown ? card?.name : undefined"
        :controls="isInteractive && !!card"
        :counters="card?.counters"
        :opponent-selected="isOpponentSelected('field', index) || isMyOpponentSelected('field', index)"
        :rotate
        :drop-zone="isInteractive ? 'field' : undefined"
        :drop-index="isInteractive ? index : undefined"
        @click.stop="isInteractive ? handleFieldClick(index) : handleOpponentCardClick('field', index)"
        @click.right.prevent="
          isInteractive && isShiftHeld
            ? shiftRightClickFieldCard(index)
            : (!card?.faceDown || canView) && inspectCard(card, 'field')
        "
        @action="(evt) => isInteractive && handleAction(evt, 'field', index)"
        @increment="(evt) => isInteractive && handleIncrement(evt, 'field', index)"
        @update="debouncedUpdateCardStats"
        @pointerdown="isInteractive && card && startCardDrag(card as YugiohCard, 'field', index, $event)"
      />

      <!-- Deck -->
      <card-slot
        class="bg-amber-900"
        name="Deck Zone"
        :cards="getCards('deck')"
        :hint="getCards('deck').length"
        :actions="isInteractive && deckActions"
        :selected-index="isInteractive && selectedCardLocation === 'deck' && selectedCardIndex"
        :rotate
        :drop-zone="isInteractive ? 'deck' : undefined"
        @click.stop="isInteractive && drawCard('deck')"
        @click.right.prevent="canView && handleDeckRightClick()"
        @action="(evt) => isInteractive && handleDeckAction(evt)"
      />
    </div>

    <!-- ── Hand ──────────────────────────────────────────────────────────── -->
    <div
      data-drop-zone="hand"
      :class="{ 'rounded ring-2 ring-yellow-400 ring-inset': !!dragging && hoverZone?.location === 'hand' }"
      @click="isInteractive && logMoveCard('hand')"
      class="mt-4 flex h-[min(20vw,20vh)] w-full justify-center"
    >
      <hand-card
        v-for="(card, index) in getCards('hand')"
        :key="`${card?.id}+${index}`"
        :card="card!"
        :index="index"
        :hand-length="getCards('hand').length"
        :is-interactive="!!isInteractive"
        :can-view="!!canView"
        :selected="isSelected('hand', index)"
        :opponent-highlighted="isOpponentSelected('hand', index) || isMyOpponentSelected('hand', index)"
        :dragging-uid="dragging?.card.uid"
        @select="isInteractive ? selectCard('hand', index) : handleOpponentCardClick('hand', index)"
        @inspect="(canView || card?.revealed) && inspectCard(card, 'hand')"
        @shift-click="shiftClickHandCard(index)"
        @shift-right-click="shiftRightClickHandCard(index)"
        @reveal="showToOpponent(index)"
        @give="giveToOpponent('hand', index)"
        @start-drag="(evt) => card && startCardDrag(card, 'hand', index, evt)"
      />
    </div>

    <!-- ── Inspect modal ─────────────────────────────────────────────────── -->
    <inspect-modal
      v-if="inspectedCardsList"
      :cards="inspectedCardsList"
      :show-cards="visibleCards"
      :inspected-cards-location="inspectedCardsLocation"
      :selected-index="
        selectedCardLocation === inspectedCardsLocation ||
        ((selectedCardLocation === 'field' || selectedCardLocation === 'zones') &&
          inspectedCardsLocation === 'attached')
          ? selectedCardIndex
          : undefined
      "
      :card-index="inspectedFieldIndex"
      :controls="isInteractive && !hideInspectControls"
      @close="closeInspectModal"
      @select="selectInspectedCard"
      @draw="drawFromInspected"
      @reveal="revealCard"
      @flip="flipCard"
    />

    <!-- Drag ghost image -->
    <Teleport to="body">
      <img
        v-if="dragging"
        :src="dragging.imageUrl"
        class="pointer-events-none fixed z-[10000] h-28 -translate-x-1/2 -translate-y-1/2 rounded shadow-2xl"
        :style="{ left: `${dragX}px`, top: `${dragY}px` }"
      />
    </Teleport>
  </div>
</template>
