import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue'

import { clampRatio, getTopPileCard } from '@/lib/crawlv3/game-state'
import { shuffleItems } from '@/lib/crawlv3/ui-utils'
import type { Crawlv3CardState, Crawlv3Game, Crawlv3Player, Crawlv3Zone } from '@/types/crawlv3'
import type { Crawlv3DragState, Crawlv3PileZone, Crawlv3TooltipState, QueuedCrawlv3Action } from '@/types/crawlv3-ui'

type UseCrawlv3BoardOptions = {
  game: ComputedRef<Crawlv3Game | null>
  myPlayer: ComputedRef<Crawlv3Player | null>
  actorPlayer?: ComputedRef<Crawlv3Player | null>
  revealAllCards?: ComputedRef<boolean>
  isPerspectiveFlipped: ComputedRef<boolean>
  tableCards: ComputedRef<Crawlv3CardState[]>
  myHandCards: ComputedRef<Crawlv3CardState[]>
  myDeckCards: ComputedRef<Crawlv3CardState[]>
  myDiscardCards: ComputedRef<Crawlv3CardState[]>
  fieldCardWidth: Ref<string>
  selectedCardId: Ref<string | null>
  enqueueAction: (action: QueuedCrawlv3Action) => void
  onSelectCard?: (cardId: string | null) => void
  onClearTransientUi?: () => void
}

type StartCardDragOptions = {
  selectable?: boolean
}

const fixedBoardCardScale = 0.95
const pileZones = new Set<Crawlv3Zone>(['deck', 'extraDeck', 'discard', 'exhausted'])

function isPileZone(zone: Crawlv3Zone): zone is Extract<Crawlv3Zone, 'deck' | 'extraDeck' | 'discard' | 'exhausted'> {
  return pileZones.has(zone)
}

function parseCategoryList(categoriesText: string | undefined) {
  return (categoriesText ?? '')
    .split(',')
    .map((category) => category.trim().toLowerCase())
    .filter(Boolean)
}

function cardMatchesCategories(card: Pick<Crawlv3CardState, 'category'>, categories: string[]) {
  if (!categories.length) return false
  const cardCategories = card.category
    .split(',')
    .map((category) => category.trim().toLowerCase())
    .filter(Boolean)

  return cardCategories.some((category) => categories.includes(category))
}

export function useCrawlv3Board({
  game,
  myPlayer,
  actorPlayer = myPlayer,
  revealAllCards = computed(() => false),
  isPerspectiveFlipped,
  tableCards,
  myHandCards,
  myDeckCards,
  myDiscardCards,
  fieldCardWidth,
  selectedCardId,
  enqueueAction,
  onSelectCard,
  onClearTransientUi,
}: UseCrawlv3BoardOptions) {
  const boardCardScale = ref(fixedBoardCardScale)
  const hoveredTooltip = ref<Crawlv3TooltipState | null>(null)
  const dragState = ref<Crawlv3DragState | null>(null)

  const boardCardScaleLabel = computed(() => `${Math.round(boardCardScale.value * 100)}%`)

  const dragGhostStyle = computed(() => {
    const currentDrag = dragState.value

    if (!currentDrag) {
      return {
        left: '0px',
        top: '0px',
      }
    }

    return {
      left: `${currentDrag.ghostX}px`,
      top: `${currentDrag.ghostY}px`,
      width: `${currentDrag.cardWidth}px`,
      height: `${currentDrag.cardHeight}px`,
    }
  })

  function clearBoardTransientUi() {
    hoveredTooltip.value = null
    dragState.value = null
  }

  function getCardRenderFace(card: Crawlv3CardState) {
    if (!myPlayer.value)
      return card.zone !== 'hand' && card.zone !== 'discard' && card.zone !== 'exhausted' && card.faceUp
    if (revealAllCards.value && card.zone === 'hand') return true
    if (card.zone === 'hand') return card.owner === myPlayer.value
    if ((card.zone === 'discard' || card.zone === 'exhausted') && card.owner !== myPlayer.value) return false
    return card.faceUp
  }

  function canSeeCardDetails(card: Crawlv3CardState) {
    if (revealAllCards.value) return true
    if (!myPlayer.value)
      return card.faceUp && card.zone !== 'hand' && card.zone !== 'discard' && card.zone !== 'exhausted'
    if (card.owner === myPlayer.value) return true
    if (card.zone === 'hand' || card.zone === 'discard' || card.zone === 'exhausted') return false
    return card.faceUp
  }

  function normalizeZonePoint(zone: Crawlv3Zone, x: number, y: number) {
    if (!isPerspectiveFlipped.value || (zone !== 'table' && zone !== 'hand')) {
      return { x, y }
    }

    return {
      x: clampRatio(1 - x),
      y: clampRatio(1 - y),
    }
  }

  function cardPositionStyle(card: Crawlv3CardState) {
    const scale = boardCardScale.value.toFixed(2)
    const point = normalizeZonePoint(card.zone, card.x, card.y)
    const width = card.zone === 'table' ? fieldCardWidth.value : card.zone === 'hand' ? fieldCardWidth.value : undefined

    return {
      left: `${(point.x * 100).toFixed(2)}%`,
      top: `${(point.y * 100).toFixed(2)}%`,
      zIndex: String(card.z),
      transform: 'translate(-50%, -50%)',
      ...(width ? { width } : {}),
    }
  }

  function selectCard(cardId: string) {
    const nextCardId = selectedCardId.value === cardId ? null : cardId
    selectedCardId.value = nextCardId
    onSelectCard?.(nextCardId)
  }

  function adjustBoardCardScale(delta: number) {
    boardCardScale.value = Math.min(1.5, Math.max(0.65, Number((boardCardScale.value + delta).toFixed(2))))
  }

  function getTablePlacementPatch(card: Crawlv3CardState) {
    const faceDown = cardMatchesCategories(card, parseCategoryList(game.value?.config.faceDownCategoriesText))
    return {
      faceUp: !faceDown,
      rotated: faceDown,
    }
  }

  function getDragPreviewPlacement(
    card: Crawlv3CardState,
    target: ReturnType<typeof resolveDropTarget> | null,
    event: PointerEvent,
  ) {
    if (target?.zone === 'table' && event.shiftKey) {
      return { faceUp: false, rotated: true }
    }

    if (card && target?.zone === 'table' && card.zone !== 'table') {
      return getTablePlacementPatch(card)
    }

    if (target?.zone === 'hand') {
      return { faceUp: true, rotated: false }
    }

    return null
  }

  function startCardDrag(card: Crawlv3CardState, event: PointerEvent, options: StartCardDragOptions = {}) {
    if (event.button !== 0) return
    const selectable = options.selectable ?? true
    if (!actorPlayer.value || card.owner !== actorPlayer.value) {
      if (selectable) selectCard(card.instanceId)
      return
    }

    const cardElement = event.currentTarget as HTMLElement | null
    const cardShell = (event.target as HTMLElement | null)?.closest('[data-crawlv3-card-shell]') as HTMLElement | null
    const positionElement = cardShell ?? cardElement
    const rect = positionElement?.getBoundingClientRect()
    const pointerOffsetX = rect ? event.clientX - rect.left : (positionElement?.offsetWidth ?? 0) / 2
    const pointerOffsetY = rect ? event.clientY - rect.top : (positionElement?.offsetHeight ?? 0) / 2

    event.preventDefault()
    hoveredTooltip.value = null
    dragState.value = {
      instanceId: card.instanceId,
      startX: event.clientX,
      startY: event.clientY,
      ghostX: rect?.left ?? event.clientX - pointerOffsetX,
      ghostY: rect?.top ?? event.clientY - pointerOffsetY,
      pointerOffsetX,
      pointerOffsetY,
      cardWidth: rect?.width || positionElement?.offsetWidth || 0,
      cardHeight: rect?.height || positionElement?.offsetHeight || 0,
      active: false,
      selectable,
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  function resolveDropTarget(clientX: number, clientY: number, currentDrag?: Crawlv3DragState) {
    const elements = document.elementsFromPoint(clientX, clientY)

    for (const element of elements) {
      const dropElement = (element as HTMLElement).closest('[data-crawlv3-drop-zone]') as HTMLElement | null
      if (!dropElement) continue

      const zone = dropElement.dataset.crawlv3DropZone as Crawlv3Zone
      const owner = dropElement.dataset.crawlv3Owner as Crawlv3Player | undefined
      const rect = dropElement.getBoundingClientRect()

      if (isPileZone(zone)) {
        return { zone, owner }
      }

      const centerX = currentDrag ? clientX - currentDrag.pointerOffsetX + currentDrag.cardWidth / 2 : clientX
      const centerY = currentDrag ? clientY - currentDrag.pointerOffsetY + currentDrag.cardHeight / 2 : clientY
      const rawX = clampRatio((centerX - rect.left) / rect.width)
      const rawY = clampRatio((centerY - rect.top) / rect.height)
      const point = normalizeZonePoint(zone, rawX, rawY)

      return {
        zone,
        owner,
        x: point.x,
        y: point.y,
      }
    }

    return null
  }

  function handlePointerMove(event: PointerEvent) {
    const currentDrag = dragState.value
    if (!currentDrag) return

    const deltaX = event.clientX - currentDrag.startX
    const deltaY = event.clientY - currentDrag.startY
    const nextActive = currentDrag.active || Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 6

    if (nextActive && !currentDrag.active && currentDrag.selectable) {
      selectedCardId.value = currentDrag.instanceId
    }

    const card = game.value?.cards[currentDrag.instanceId]
    const target = nextActive ? resolveDropTarget(event.clientX, event.clientY, currentDrag) : null
    const previewPlacement = card && currentDrag.selectable ? getDragPreviewPlacement(card, target, event) : null

    dragState.value = {
      ...currentDrag,
      ghostX: event.clientX - currentDrag.pointerOffsetX,
      ghostY: event.clientY - currentDrag.pointerOffsetY,
      active: nextActive,
      previewFaceUp: previewPlacement?.faceUp,
      previewRotated: previewPlacement?.rotated,
    }
  }

  function handlePointerUp(event: PointerEvent) {
    const currentDrag = dragState.value
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    clearBoardTransientUi()
    onClearTransientUi?.()

    if (!currentDrag) return

    const card = game.value?.cards[currentDrag.instanceId]
    if (!card) return

    if (!currentDrag.active) {
      if (!currentDrag.selectable) return
      selectCard(card.instanceId)
      return
    }

    const target = resolveDropTarget(event.clientX, event.clientY, currentDrag)
    if (!target || !actorPlayer.value) return

    if ((isPileZone(target.zone) || target.zone === 'hand') && target.owner !== actorPlayer.value) {
      return
    }

    if (isPileZone(target.zone) && target.zone === card.zone && target.owner === card.owner) {
      return
    }

    const entersTableFromAnotherZone = target.zone === 'table' && card.zone !== 'table'
    const tablePlacementPatch =
      target.zone === 'table' && event.shiftKey
        ? { faceUp: false, rotated: true }
        : entersTableFromAnotherZone
          ? getTablePlacementPatch(card)
          : {}

    enqueueAction({
      type: 'move_card',
      instanceId: card.instanceId,
      zone: target.zone,
      ...(isPileZone(target.zone) ? {} : { x: target.x, y: target.y }),
      ...(target.zone === 'hand' ? { faceUp: true, rotated: false } : {}),
      ...tablePlacementPatch,
    })
  }

  function defaultZonePosition(zone: Exclude<Crawlv3Zone, 'deck' | 'extraDeck' | 'discard' | 'exhausted'>) {
    const zoneCards = zone === 'table' ? tableCards.value.length : myHandCards.value.length
    if (zone === 'hand') {
      const slotIndex = zoneCards % 6
      const rowOffset = Math.floor(zoneCards / 6) * 0.015
      const randomOffset = (Math.random() - 0.5) * 0.035
      const centeredSlots = [0.5, 0.43, 0.57, 0.36, 0.64, 0.71]
      return {
        x: clampRatio(centeredSlots[slotIndex] + rowOffset + randomOffset, 0.5),
        y: 0.5,
      }
    }

    if (zone === 'table') {
      const centeredSlots = [
        { x: 0.5, y: 0.5 },
        { x: 0.43, y: 0.5 },
        { x: 0.57, y: 0.5 },
        { x: 0.5, y: 0.39 },
        { x: 0.5, y: 0.61 },
        { x: 0.43, y: 0.39 },
        { x: 0.57, y: 0.61 },
        { x: 0.57, y: 0.39 },
        { x: 0.43, y: 0.61 },
      ]
      return centeredSlots[zoneCards % centeredSlots.length]
    }

    return {
      x: 0.5,
      y: 0.5,
    }
  }

  function moveCardToZone(instanceId: string, zone: Crawlv3Zone) {
    if (isPileZone(zone)) {
      enqueueAction({
        type: 'move_card',
        instanceId,
        zone,
      })
      return
    }

    const position = defaultZonePosition(zone)
    const card = game.value?.cards[instanceId]
    const tablePlacementPatch = zone === 'table' && card?.zone !== 'table' && card ? getTablePlacementPatch(card) : {}

    enqueueAction({
      type: 'move_card',
      instanceId,
      zone,
      x: position.x,
      y: position.y,
      ...(zone === 'hand' ? { faceUp: true, rotated: false } : {}),
      ...tablePlacementPatch,
    })
  }

  function drawTopDeckCard() {
    if (!actorPlayer.value || !game.value) return

    const topDeckCard = getTopPileCard(game.value.cards, 'deck', actorPlayer.value)
    if (topDeckCard) {
      moveCardToZone(topDeckCard.instanceId, 'hand')
      return
    }

    if (!myDiscardCards.value.length) return

    const extraDeckCategories = parseCategoryList(game.value.config.extraDeckCategoriesText)
    const shuffledCards = shuffleItems(myDiscardCards.value)
    const drawnCard = [...shuffledCards].reverse().find((card) => !cardMatchesCategories(card, extraDeckCategories))

    enqueueAction({
      type: 'shuffle_discard_into_deck',
      orderedCardIds: shuffledCards.map((card) => card.instanceId),
    })

    if (!drawnCard) return

    enqueueAction({
      type: 'move_card',
      instanceId: drawnCard.instanceId,
      zone: 'hand',
      faceUp: true,
      rotated: false,
    })
  }

  function shuffleDeck() {
    const shuffledIds = shuffleItems(myDeckCards.value).map((card) => card.instanceId)

    enqueueAction({
      type: 'shuffle_deck',
      orderedCardIds: shuffledIds,
    })
  }

  function shuffleDiscardIntoDeck() {
    if (!myDiscardCards.value.length) return

    const shuffledIds = shuffleItems([...myDeckCards.value, ...myDiscardCards.value]).map((card) => card.instanceId)

    enqueueAction({
      type: 'shuffle_discard_into_deck',
      orderedCardIds: shuffledIds,
    })
  }

  function updateTooltip(card: Crawlv3CardState, event: MouseEvent) {
    if (!canSeeCardDetails(card)) return
    hoveredTooltip.value = {
      cardId: card.instanceId,
      x: event.clientX,
      y: event.clientY,
    }
  }

  function clearTooltip(card?: Crawlv3CardState) {
    if (!card || hoveredTooltip.value?.cardId === card.instanceId) {
      hoveredTooltip.value = null
    }
  }

  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
  })

  return {
    boardCardScale,
    boardCardScaleLabel,
    hoveredTooltip,
    dragState,
    dragGhostStyle,
    clearBoardTransientUi,
    getCardRenderFace,
    canSeeCardDetails,
    cardPositionStyle,
    adjustBoardCardScale,
    startCardDrag,
    moveCardToZone,
    drawTopDeckCard,
    shuffleDeck,
    shuffleDiscardIntoDeck,
    updateTooltip,
    clearTooltip,
  }
}
