<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import CrawlV3CardPreviewModal from '@/components/crawlv3/CrawlV3CardPreviewModal.vue'
import CrawlV3CardTooltip from '@/components/crawlv3/CrawlV3CardTooltip.vue'
import CrawlV3CardZone from '@/components/crawlv3/CrawlV3CardZone.vue'
import CrawlV3DeckModal from '@/components/crawlv3/CrawlV3DeckModal.vue'
import CrawlV3DragGhost from '@/components/crawlv3/CrawlV3DragGhost.vue'
import CrawlV3PilePanel from '@/components/crawlv3/CrawlV3PilePanel.vue'
import CrawlV3PlayerStatsPanel from '@/components/crawlv3/CrawlV3PlayerStatsPanel.vue'
import CrawlV3RulesModal from '@/components/crawlv3/CrawlV3RulesModal.vue'
import CrawlV3SelectedCardPanel from '@/components/crawlv3/CrawlV3SelectedCardPanel.vue'
import CrawlV3Select from '@/components/crawlv3/CrawlV3Select.vue'
import CrawlV3ShortcutsModal from '@/components/crawlv3/CrawlV3ShortcutsModal.vue'
import CrawlV3StatusModal from '@/components/crawlv3/CrawlV3StatusModal.vue'
import { useCrawlv3Board } from '@/composables/crawlv3/useCrawlv3Board'
import { useCrawlv3Controller } from '@/composables/crawlv3/useCrawlv3Controller'
import { useCrawlv3SelectedCard } from '@/composables/crawlv3/useCrawlv3SelectedCard'
import { useCrawlv3StatusDefinitions } from '@/composables/crawlv3/useCrawlv3StatusDefinitions'
import cardBackImage from '@/assets/images/cards/cardback.png'
import { formatZoneLabel } from '@/lib/crawlv3/card-display'
import { loadCatalogCards } from '@/lib/crawlv3/catalog'
import { getTopPileCard, getZoneCards } from '@/lib/crawlv3/game-state'
import { safeTrim, shuffleItems, withDefaultCatalogConfig } from '@/lib/crawlv3/ui-utils'
import type { Crawlv3CardState, Crawlv3CatalogCard, Crawlv3Player } from '@/types/crawlv3'
import type { Crawlv3PileZone, Crawlv3SpectatorPerspective, OpenCrawlv3PileState } from '@/types/crawlv3-ui'

const {
  game,
  currentUserUid,
  myPlayer: actualPlayer,
  isSpectator,
  spectatorPerspective,
  enqueueAction,
  saveSpectatorPerspective,
  resetRoomSession,
} = useCrawlv3Controller()

const selectedCardId = ref<string | null>(null)
const previewCardId = ref<string | null>(null)
const statusCardId = ref<string | null>(null)
const openPile = ref<OpenCrawlv3PileState | null>(null)
const shortcutsOpen = ref(false)
const rulesOpen = ref(false)
const selectedMoveMode = ref(false)
const catalogCards = ref<Crawlv3CatalogCard[]>([])
const fieldCardWidth = ref('calc(clamp(38rem, min(50vw, calc(100vh - 26rem)), 68rem) * 0.16 * 63 / 88)')
let hitPointShortcutBuffer = ''
let hitPointShortcutSign: 1 | -1 = -1
let hitPointShortcutTimer: ReturnType<typeof setTimeout> | null = null
let catalogRequestId = 0

const { statusDefinitions } = useCrawlv3StatusDefinitions({
  config: computed(() => game.value?.config),
})

const revealAllCards = computed(() => isSpectator.value && spectatorPerspective.value === 'both')
const spectatorPerspectiveOptions = computed<{ value: Crawlv3SpectatorPerspective; label: string }[]>(() => [
  { value: 'both', label: 'Both' },
  { value: 'player1', label: game.value?.players.player1?.username ?? 'Player 1' },
  { value: 'player2', label: game.value?.players.player2?.username ?? 'Player 2' },
])
const myPlayer = computed<Crawlv3Player>(() => {
  if (actualPlayer.value) return actualPlayer.value
  return spectatorPerspective.value === 'player2' ? 'player2' : 'player1'
})
const opponentPlayer = computed<Crawlv3Player>(() => (myPlayer.value === 'player1' ? 'player2' : 'player1'))
const isPerspectiveFlipped = computed(() => myPlayer.value === 'player2')
const isPlayerInteractive = computed(() => !!actualPlayer.value)

const catalogCardsById = computed(() => new Map(catalogCards.value.map((card) => [card.id, card])))

function hydrateCardDetails(card: Crawlv3CardState): Crawlv3CardState {
  const catalogCard = catalogCardsById.value.get(card.cardId)
  if (!catalogCard) return card

  return {
    ...card,
    title: catalogCard.title || card.title,
    cost: catalogCard.cost || card.cost,
    baseAtk: catalogCard.atk || card.baseAtk,
    baseDef: catalogCard.def || card.baseDef,
    atk: card.atk || catalogCard.atk,
    def: card.def || catalogCard.def,
    category: catalogCard.category || card.category,
    race: card.race || catalogCard.race,
    damageType: card.damageType || catalogCard.damageType,
    img: catalogCard.img || card.img,
    description: catalogCard.description || card.description,
    imageUrl: catalogCard.imageUrl || card.imageUrl,
  }
}

const displayGame = computed(() => {
  if (!game.value || !catalogCards.value.length) return game.value

  return {
    ...game.value,
    cards: Object.fromEntries(
      Object.entries(game.value.cards).map(([instanceId, card]) => [instanceId, hydrateCardDetails(card)]),
    ),
  }
})

const tableCards = computed(() => (displayGame.value ? getZoneCards(displayGame.value.cards, 'table') : []))
const myHandCards = computed(() =>
  displayGame.value && myPlayer.value ? getZoneCards(displayGame.value.cards, 'hand', myPlayer.value) : [],
)
const opponentHandCards = computed(() =>
  displayGame.value && opponentPlayer.value ? getZoneCards(displayGame.value.cards, 'hand', opponentPlayer.value) : [],
)
const myDeckCards = computed(() =>
  displayGame.value && myPlayer.value ? getZoneCards(displayGame.value.cards, 'deck', myPlayer.value) : [],
)
const opponentDeckCards = computed(() =>
  displayGame.value && opponentPlayer.value ? getZoneCards(displayGame.value.cards, 'deck', opponentPlayer.value) : [],
)
const myExtraDeckCards = computed(() =>
  displayGame.value && myPlayer.value ? getZoneCards(displayGame.value.cards, 'extraDeck', myPlayer.value) : [],
)
const opponentExtraDeckCards = computed(() =>
  displayGame.value && opponentPlayer.value
    ? getZoneCards(displayGame.value.cards, 'extraDeck', opponentPlayer.value)
    : [],
)
const myDiscardCards = computed(() =>
  displayGame.value && myPlayer.value ? getZoneCards(displayGame.value.cards, 'discard', myPlayer.value) : [],
)
const opponentDiscardCards = computed(() =>
  displayGame.value && opponentPlayer.value
    ? getZoneCards(displayGame.value.cards, 'discard', opponentPlayer.value)
    : [],
)
const myExhaustedCards = computed(() =>
  displayGame.value && myPlayer.value ? getZoneCards(displayGame.value.cards, 'exhausted', myPlayer.value) : [],
)
const opponentExhaustedCards = computed(() =>
  displayGame.value && opponentPlayer.value
    ? getZoneCards(displayGame.value.cards, 'exhausted', opponentPlayer.value)
    : [],
)

const myTopDiscardCard = computed(() =>
  displayGame.value && myPlayer.value
    ? (getTopPileCard(displayGame.value.cards, 'discard', myPlayer.value) ?? null)
    : null,
)
const myTopDeckCard = computed(() =>
  displayGame.value && myPlayer.value
    ? (getTopPileCard(displayGame.value.cards, 'deck', myPlayer.value) ?? null)
    : null,
)
const myTopExtraDeckCard = computed(() =>
  displayGame.value && myPlayer.value
    ? (getTopPileCard(displayGame.value.cards, 'extraDeck', myPlayer.value) ?? null)
    : null,
)
const myTopExhaustedCard = computed(() =>
  displayGame.value && myPlayer.value
    ? (getTopPileCard(displayGame.value.cards, 'exhausted', myPlayer.value) ?? null)
    : null,
)

const {
  hoveredTooltip,
  dragState,
  dragGhostStyle,
  clearBoardTransientUi,
  getCardRenderFace,
  canSeeCardDetails,
  cardPositionStyle,
  startCardDrag,
  moveCardToZone,
  drawTopDeckCard,
  shuffleDeck,
  shuffleDiscardIntoDeck,
  updateTooltip,
  clearTooltip,
} = useCrawlv3Board({
  game: displayGame,
  myPlayer,
  actorPlayer: actualPlayer,
  revealAllCards,
  isPerspectiveFlipped,
  tableCards,
  myHandCards,
  myDeckCards,
  myDiscardCards,
  fieldCardWidth,
  selectedCardId,
  enqueueAction,
  onSelectCard: publishSelectedCard,
})

const {
  statDrafts,
  selectedAtk,
  selectedDef,
  selectedRace,
  selectedDamageType,
  focusedSelectedStat,
  selectedOwnCard,
  selectedOwnCardPreview,
  statusCard,
  statusLabels,
  raceOptions,
  damageTypeOptions,
  savePlayerStats,
  adjustLifePoints,
  adjustActionPoints,
  resetActionPoints,
  saveSelectedStat,
  blurSelectedStat,
  saveSelectedDetail,
  toggleSelectedFace,
  toggleSelectedRotation,
  decrementCardStatus,
  incrementCardStatus,
  saveSelectedStatuses,
  getCardStatusEntries,
  clearSelectedCardState,
} = useCrawlv3SelectedCard({
  game: displayGame,
  myPlayer: actualPlayer,
  statusDefinitions,
  selectedCardId,
  statusCardId,
  enqueueAction,
})

const tooltipCard = computed(() => {
  if (!displayGame.value || !hoveredTooltip.value) return null
  return displayGame.value.cards[hoveredTooltip.value.cardId] ?? null
})

const previewCard = computed(() => {
  if (!displayGame.value || !previewCardId.value) return null
  return displayGame.value.cards[previewCardId.value] ?? null
})

const dragPreviewCard = computed(() => {
  if (!displayGame.value || !dragState.value) return null
  const card = displayGame.value.cards[dragState.value.instanceId]
  if (!card) return null

  if (dragState.value.previewFaceUp === undefined && dragState.value.previewRotated === undefined) return card

  return {
    ...card,
    faceUp: dragState.value.previewFaceUp ?? card.faceUp,
    rotated: dragState.value.previewRotated ?? card.rotated,
  }
})

const dragPreviewShowFace = computed(() => {
  if (!dragPreviewCard.value) return false
  return dragState.value?.previewFaceUp ?? getCardRenderFace(dragPreviewCard.value)
})

const tooltipBuffs = computed(() => (tooltipCard.value ? getCardStatusEntries(tooltipCard.value, 'buff') : []))
const tooltipDebuffs = computed(() => (tooltipCard.value ? getCardStatusEntries(tooltipCard.value, 'debuff') : []))
const selectedRaceOptions = computed(() => [
  { value: '', label: 'No race' },
  ...raceOptions.value.map((option) => ({ value: option, label: option })),
])
const selectedDamageTypeOptions = computed(() => [
  { value: '', label: 'No type' },
  ...damageTypeOptions.value.map((option) => ({ value: option, label: option })),
])

const selectedCard = computed(() => {
  if (!displayGame.value || !selectedCardId.value) return null
  return displayGame.value.cards[selectedCardId.value] ?? null
})
const selectedCardVisible = computed(() => (selectedCard.value ? canSeeCardDetails(selectedCard.value) : false))
const selectedReadonlyShowFace = computed(() => !!selectedCard.value && selectedCardVisible.value)
const selectedCardPreview = computed(() => {
  if (!selectedCard.value) return null
  return {
    ...selectedCard.value,
    rotated: false,
  }
})
const selectedCardHighlightVisibleTo = computed<Crawlv3Player[]>(() => {
  if (!selectedCard.value) return []
  if (actualPlayer.value) {
    return selectedCard.value.owner !== actualPlayer.value ? [selectedCard.value.owner] : []
  }
  if (!isSpectator.value) return []
  return ['player1', 'player2']
})
const otherSelectedCardIds = computed(() => {
  const selections = displayGame.value?.cardSelections ?? {}
  return Object.entries(selections)
    .filter(
      ([uid, selection]) =>
        uid !== currentUserUid.value &&
        !!selection.instanceId &&
        (isSpectator.value || (actualPlayer.value && selection.visibleTo.includes(actualPlayer.value))),
    )
    .map(([, selection]) => selection.instanceId as string)
})

const fieldImageUrl = computed(() =>
  game.value ? withDefaultCatalogConfig(game.value.config).fieldImageUrl.trim() : '',
)

const activePileCards = computed(() => {
  if (!openPile.value || !displayGame.value) return []
  const cards = getZoneCards(displayGame.value.cards, openPile.value.zone, openPile.value.owner)
  if (!openPile.value.visibleCardIds) return cards

  const cardMap = new Map(cards.map((card) => [card.instanceId, card]))
  return openPile.value.visibleCardIds
    .map((instanceId) => cardMap.get(instanceId))
    .filter((card): card is Crawlv3CardState => !!card)
})

const activePileInteractive = computed(() => !!openPile.value && openPile.value.owner === actualPlayer.value)

const activePileTitle = computed(() => {
  if (!game.value || !openPile.value) return ''
  const playerName = game.value.players[openPile.value.owner]?.username ?? 'Player'
  return `${playerName} ${formatZoneLabel(openPile.value.zone)}`
})

watch(
  () => JSON.stringify(game.value?.config ?? {}),
  async () => {
    const config = game.value?.config
    if (!config || !safeTrim(config.csvUrl) || !safeTrim(config.headers.id) || !safeTrim(config.headers.title)) {
      catalogCards.value = []
      return
    }

    const requestId = ++catalogRequestId
    try {
      const cards = await loadCatalogCards(config)
      if (requestId === catalogRequestId) {
        catalogCards.value = cards
      }
    } catch {
      if (requestId === catalogRequestId) {
        catalogCards.value = []
      }
    }
  },
  { immediate: true },
)

function clearTransientUi() {
  clearBoardTransientUi()
}

function publishSelectedCard(instanceId: string | null) {
  enqueueAction({
    type: 'select_card',
    instanceId,
    visibleTo: instanceId ? selectedCardHighlightVisibleTo.value : [],
  })
}

function clearPublishedSelectedCardState() {
  clearSelectedCardState()
  publishSelectedCard(null)
}

function savePerspective(value: string) {
  if (value !== 'both' && value !== 'player1' && value !== 'player2') return
  saveSpectatorPerspective(value)
}

function leaveRoom() {
  previewCardId.value = null
  clearPublishedSelectedCardState()
  openPile.value = null
  shortcutsOpen.value = false
  rulesOpen.value = false
  resetRoomSession()
  clearTransientUi()
}

function completeGame() {
  enqueueAction({
    type: 'complete_game',
  })
  selectedCardId.value = null
  publishSelectedCard(null)
  statusCardId.value = null
  previewCardId.value = null
  openPile.value = null
  shortcutsOpen.value = false
  rulesOpen.value = false
  clearTransientUi()
}

function moveSelectedCardTo(zone: Crawlv3PileZone | 'table' | 'hand') {
  if (!selectedOwnCard.value) return
  moveCardToZone(selectedOwnCard.value.instanceId, zone)
  selectedMoveMode.value = false
}

function openPileViewer(owner: Crawlv3Player, zone: Crawlv3PileZone) {
  if (!revealAllCards.value && owner !== myPlayer.value && (zone === 'discard' || zone === 'exhausted')) return
  const cards = game.value ? getZoneCards(game.value.cards, zone, owner) : []
  openPile.value = {
    owner,
    zone,
    visibleCardIds: zone === 'deck' || zone === 'extraDeck' ? shuffleItems(cards).map((card) => card.instanceId) : null,
  }
}

function pilePreviewImage(card: Crawlv3CardState | null) {
  return card?.imageUrl || ''
}

function startTopPileDrag(zone: Crawlv3PileZone, event: PointerEvent) {
  if (!isPlayerInteractive.value) return

  if (zone === 'deck' && myTopDeckCard.value) {
    startCardDrag(myTopDeckCard.value, event)
  } else if (zone === 'extraDeck' && myTopExtraDeckCard.value) {
    startCardDrag(myTopExtraDeckCard.value, event)
  } else if (zone === 'discard' && myTopDiscardCard.value) {
    startCardDrag(myTopDiscardCard.value, event)
  } else if (zone === 'exhausted' && myTopExhaustedCard.value) {
    startCardDrag(myTopExhaustedCard.value, event)
  }
}

function updateFieldCardWidth(size: { height: number }) {
  fieldCardWidth.value = `${size.height * 0.16 * (63 / 88)}px`
}

function isOwnCardInteractive(card: Crawlv3CardState) {
  return card.owner === actualPlayer.value
}

function isKeyboardShortcutTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  if (!element) return true
  return !element.closest('input, textarea, select, [contenteditable="true"]')
}

function getKeyboardDigit(event: KeyboardEvent) {
  if (/^Digit\d$/.test(event.code)) return event.code.slice(5)
  if (/^Numpad\d$/.test(event.code)) return event.code.slice(6)
  return null
}

function clearHitPointShortcutTimer() {
  if (!hitPointShortcutTimer) return
  clearTimeout(hitPointShortcutTimer)
  hitPointShortcutTimer = null
}

function commitHitPointShortcutBuffer() {
  if (!actualPlayer.value || !hitPointShortcutBuffer) return
  const amount = Number(hitPointShortcutBuffer)
  hitPointShortcutBuffer = ''
  clearHitPointShortcutTimer()
  if (!Number.isFinite(amount) || amount <= 0) return
  adjustLifePoints(actualPlayer.value, amount * hitPointShortcutSign)
}

function queueHitPointShortcutDigit(digit: string, sign: 1 | -1) {
  if (hitPointShortcutBuffer && hitPointShortcutSign !== sign) {
    commitHitPointShortcutBuffer()
  }

  hitPointShortcutSign = sign
  hitPointShortcutBuffer = `${hitPointShortcutBuffer}${digit}`
  clearHitPointShortcutTimer()
  hitPointShortcutTimer = setTimeout(commitHitPointShortcutBuffer, 2000)
}

function handleKeyboardShortcut(event: KeyboardEvent) {
  if (event.repeat || !isKeyboardShortcutTarget(event.target)) return

  if (event.key === 'Escape') {
    if (statusCardId.value || previewCardId.value || openPile.value || shortcutsOpen.value || rulesOpen.value) {
      event.preventDefault()
      statusCardId.value = null
      previewCardId.value = null
      openPile.value = null
      shortcutsOpen.value = false
      rulesOpen.value = false
    }
    return
  }

  if (!isPlayerInteractive.value) return

  const digit = getKeyboardDigit(event)
  if (digit !== null) {
    event.preventDefault()
    queueHitPointShortcutDigit(digit, event.shiftKey ? 1 : -1)
    return
  }

  const key = event.key.toLowerCase()
  if (event.code === 'Space') {
    event.preventDefault()
    drawTopDeckCard()
    return
  }

  if (key === 'a') {
    event.preventDefault()
    if (actualPlayer.value) adjustActionPoints(actualPlayer.value, event.shiftKey ? 1 : -1)
    return
  }

  if (key === 'r') {
    event.preventDefault()
    if (actualPlayer.value) resetActionPoints(actualPlayer.value)
    return
  }

  if (!selectedOwnCard.value) return

  if (key === 'm') {
    event.preventDefault()
    statusCardId.value = selectedOwnCard.value.instanceId
    return
  }

  if (key === 'd') {
    event.preventDefault()
    moveSelectedCardTo('discard')
    return
  }

  if (key === 'e') {
    event.preventDefault()
    moveSelectedCardTo('exhausted')
    return
  }

  if (key === 'h') {
    event.preventDefault()
    moveSelectedCardTo('hand')
    return
  }

  if (key === 't') {
    event.preventDefault()
    moveSelectedCardTo('table')
    return
  }

  if (selectedOwnCard.value.zone !== 'table') return

  if (key === 'f') {
    event.preventDefault()
    toggleSelectedFace()
  } else if (key === 's') {
    event.preventDefault()
    toggleSelectedRotation()
  }
}

watch(
  () => selectedOwnCard.value?.instanceId,
  () => {
    selectedMoveMode.value = false
  },
)

watch(
  () => (currentUserUid.value && displayGame.value ? displayGame.value.cardSelections?.[currentUserUid.value] : null),
  (selection) => {
    selectedCardId.value = selection?.instanceId ?? null
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('keydown', handleKeyboardShortcut)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyboardShortcut)
  clearHitPointShortcutTimer()
})
</script>

<template>
  <div v-if="game && myPlayer && opponentPlayer" class="mx-auto py-6">
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div class="space-y-4">
        <header
          class="flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] border border-white/10 bg-neutral-950/70 px-5 py-4 shadow-2xl backdrop-blur-sm"
        >
          <div>
            <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Room Code</p>
            <p class="mt-1 text-3xl font-semibold tracking-[0.2em] text-amber-200">{{ game.code }}</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <label v-if="isSpectator" class="block min-w-48">
              <span class="sr-only">Spectate</span>
              <CrawlV3Select
                v-model="spectatorPerspective"
                :options="spectatorPerspectiveOptions"
                @change="savePerspective"
              />
            </label>
            <button
              type="button"
              class="cursor-pointer rounded-full border border-violet-300/35 bg-violet-300/12 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-300/50 hover:bg-violet-300/18"
              @click="rulesOpen = true"
            >
              Rules
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-full border border-sky-300/35 bg-sky-300/12 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-300/50 hover:bg-sky-300/18"
              @click="shortcutsOpen = true"
            >
              Shortcuts
            </button>
            <button
              v-if="isPlayerInteractive"
              type="button"
              class="cursor-pointer rounded-full border border-amber-300/35 bg-amber-300/12 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-300/18"
              @click="completeGame"
            >
              Complete Game
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
              @click="leaveRoom"
            >
              Leave Game
            </button>
          </div>
        </header>

        <section class="space-y-4">
          <div class="grid gap-4 xl:grid-cols-5">
            <CrawlV3PlayerStatsPanel
              v-model:life-points="statDrafts[opponentPlayer].lifePoints"
              v-model:action-points="statDrafts[opponentPlayer].actionPoints"
              eyebrow="Opponent"
              :player-name="game.players[opponentPlayer]?.username"
            />
            <CrawlV3PilePanel
              title="Opponent Spent"
              zone="discard"
              :owner="opponentPlayer"
              :count="opponentDiscardCards.length"
              :card-back-image="cardBackImage"
              :top-image="opponentDiscardCards.length ? cardBackImage : ''"
              :can-inspect="revealAllCards"
              @open="openPileViewer(opponentPlayer, $event)"
            />
            <CrawlV3PilePanel
              title="Opponent Exhausted"
              zone="exhausted"
              :owner="opponentPlayer"
              :count="opponentExhaustedCards.length"
              :card-back-image="cardBackImage"
              :top-image="opponentExhaustedCards.length ? cardBackImage : ''"
              :can-inspect="revealAllCards"
              @open="openPileViewer(opponentPlayer, $event)"
            />
            <CrawlV3PilePanel
              title="Opponent Draw"
              zone="deck"
              :owner="opponentPlayer"
              :count="opponentDeckCards.length"
              :card-back-image="cardBackImage"
              :can-inspect="revealAllCards"
              @open="openPileViewer(opponentPlayer, $event)"
            />
            <CrawlV3PilePanel
              title="Opponent Extra Deck"
              zone="extraDeck"
              :owner="opponentPlayer"
              :count="opponentExtraDeckCards.length"
              :card-back-image="cardBackImage"
              :can-inspect="revealAllCards"
              @open="openPileViewer(opponentPlayer, $event)"
            />
          </div>
          <div class="rounded-[1.75rem] border border-white/10 bg-neutral-950/70 p-3 shadow-2xl backdrop-blur-sm">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Opponent Hand</p>
                <p class="mt-1 text-sm text-white/55">{{ opponentHandCards.length }} cards</p>
              </div>
            </div>

            <CrawlV3CardZone
              :cards="opponentHandCards"
              drop-zone="hand"
              :owner="opponentPlayer"
              empty-label="Opponent hand zone"
              zone-class="relative h-[clamp(10.5rem,15vh,13rem)] overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(135deg,rgba(61,99,114,0.15),rgba(20,22,33,0.65))] ring-1 ring-white/5"
              :selected-card-id="selectedCardId"
              :status-labels="statusLabels"
              :other-selected-card-ids="otherSelectedCardIds"
              :card-position-style="cardPositionStyle"
              :get-card-render-face="getCardRenderFace"
              :is-card-interactive="() => false"
              @card-pointerdown="startCardDrag"
              @card-preview="previewCardId = $event"
              @card-tooltip="updateTooltip"
              @card-tooltip-clear="clearTooltip"
              @decrement-status="decrementCardStatus"
              @increment-status="incrementCardStatus"
              @zone-pointerdown="clearPublishedSelectedCardState"
            />
          </div>
        </section>

        <section class="rounded-[1.75rem] border border-white/10 bg-neutral-950/70 p-4 shadow-2xl backdrop-blur-sm">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Shared Table</p>
              <p class="mt-1 text-sm text-white/55">{{ tableCards.length }} cards in play</p>
            </div>
            <p class="text-sm text-white/45">Drag cards onto the field to play them.</p>
            <!--
              <div class="flex flex-wrap items-center justify-end gap-3">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-white/45">Card Size {{ boardCardScaleLabel }}</span>
                  <button type="button" :class="buttonClasses.icon" @click="adjustBoardCardScale(-0.1)">-</button>
                  <button type="button" :class="buttonClasses.icon" @click="adjustBoardCardScale(0.1)">+</button>
                </div>
              </div>
            -->
          </div>

          <CrawlV3CardZone
            :cards="tableCards"
            drop-zone="table"
            empty-label="Shared table"
            zone-class="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(69,46,24,0.22),rgba(20,16,13,0.78)),radial-gradient(circle_at_top,rgba(210,167,93,0.22),transparent_45%)] [container-type:size] ring-1 ring-white/5"
            :field-image-url="fieldImageUrl"
            match-field-image-aspect
            :selected-card-id="selectedCardId"
            :status-labels="statusLabels"
            :other-selected-card-ids="otherSelectedCardIds"
            show-grid
            :card-position-style="cardPositionStyle"
            :get-card-render-face="getCardRenderFace"
            :is-card-interactive="isOwnCardInteractive"
            @card-pointerdown="startCardDrag"
            @card-preview="previewCardId = $event"
            @card-tooltip="updateTooltip"
            @card-tooltip-clear="clearTooltip"
            @decrement-status="decrementCardStatus"
            @increment-status="incrementCardStatus"
            @zone-resize="updateFieldCardWidth"
            @zone-pointerdown="clearPublishedSelectedCardState"
          />
        </section>

        <section class="space-y-4">
          <div class="rounded-[1.75rem] border border-white/10 bg-neutral-950/70 p-3 shadow-2xl backdrop-blur-sm">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Your Hand</p>
                <p class="mt-1 text-sm text-white/55">{{ myHandCards.length }} cards</p>
              </div>
              <p class="text-sm text-white/45">Cards here stay face-up for you and hidden from your opponent</p>
            </div>

            <CrawlV3CardZone
              :cards="myHandCards"
              drop-zone="hand"
              :owner="myPlayer"
              empty-label="Your hand zone"
              zone-class="relative h-[clamp(10.5rem,15vh,13rem)] overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(135deg,rgba(54,79,55,0.15),rgba(20,22,33,0.65))] ring-1 ring-white/5"
              :selected-card-id="selectedCardId"
              :status-labels="statusLabels"
              :other-selected-card-ids="otherSelectedCardIds"
              :card-position-style="cardPositionStyle"
              :get-card-render-face="getCardRenderFace"
              :is-card-interactive="isOwnCardInteractive"
              @card-pointerdown="startCardDrag"
              @card-preview="previewCardId = $event"
              @card-tooltip="updateTooltip"
              @card-tooltip-clear="clearTooltip"
              @decrement-status="decrementCardStatus"
              @increment-status="incrementCardStatus"
              @zone-pointerdown="clearPublishedSelectedCardState"
            />
          </div>

          <div class="grid gap-4 xl:grid-cols-6">
            <CrawlV3PlayerStatsPanel
              v-model:life-points="statDrafts[myPlayer].lifePoints"
              v-model:action-points="statDrafts[myPlayer].actionPoints"
              eyebrow="You"
              :player-name="game.players[myPlayer]?.username"
              :editable="isPlayerInteractive"
              wide
              @save="savePlayerStats(myPlayer)"
              @adjust-life="adjustLifePoints(myPlayer, $event)"
              @adjust-action="adjustActionPoints(myPlayer, $event)"
              @reset-action="resetActionPoints(myPlayer)"
            />
            <CrawlV3PilePanel
              title="Your Exhausted"
              zone="exhausted"
              :owner="myPlayer"
              :count="myExhaustedCards.length"
              :card-back-image="cardBackImage"
              :top-image="pilePreviewImage(myTopExhaustedCard)"
              :interactive="isPlayerInteractive"
              can-inspect
              order-class="order-2"
              @open="openPileViewer(myPlayer, $event)"
              @drag="startTopPileDrag"
            />
            <CrawlV3PilePanel
              title="Your Spent"
              zone="discard"
              :owner="myPlayer"
              :count="myDiscardCards.length"
              :card-back-image="cardBackImage"
              :top-image="pilePreviewImage(myTopDiscardCard)"
              :interactive="isPlayerInteractive"
              can-inspect
              order-class="order-3"
              actions="spent"
              @open="openPileViewer(myPlayer, $event)"
              @drag="startTopPileDrag"
              @shuffle-spent="shuffleDiscardIntoDeck"
            />
            <CrawlV3PilePanel
              title="Your Extra Deck"
              zone="extraDeck"
              :owner="myPlayer"
              :count="myExtraDeckCards.length"
              :card-back-image="cardBackImage"
              :interactive="isPlayerInteractive"
              can-inspect
              order-class="order-4"
              @open="openPileViewer(myPlayer, $event)"
              @drag="startTopPileDrag"
            />
            <CrawlV3PilePanel
              title="Your Draw"
              zone="deck"
              :owner="myPlayer"
              :count="myDeckCards.length"
              :card-back-image="cardBackImage"
              :interactive="isPlayerInteractive"
              can-inspect
              order-class="order-5"
              actions="draw"
              @open="openPileViewer(myPlayer, $event)"
              @drag="startTopPileDrag"
              @draw="drawTopDeckCard"
              @shuffle="shuffleDeck"
            />
          </div>
        </section>
      </div>

      <CrawlV3SelectedCardPanel
        v-model:selected-atk="selectedAtk"
        v-model:selected-def="selectedDef"
        v-model:selected-race="selectedRace"
        v-model:selected-damage-type="selectedDamageType"
        v-model:focused-selected-stat="focusedSelectedStat"
        v-model:move-mode="selectedMoveMode"
        :selected-own-card="selectedOwnCard"
        :selected-own-card-preview="selectedOwnCardPreview"
        :selected-card="selectedCard"
        :selected-card-preview="selectedCardPreview"
        :selected-readonly-show-face="selectedReadonlyShowFace"
        :is-spectator="isSpectator"
        :status-labels="statusLabels"
        :race-options="selectedRaceOptions"
        :damage-type-options="selectedDamageTypeOptions"
        :get-status-entries="getCardStatusEntries"
        @preview="previewCardId = $event"
        @decrement-status="decrementCardStatus"
        @increment-status="incrementCardStatus"
        @save-stat="saveSelectedStat"
        @blur-stat="blurSelectedStat"
        @save-detail="saveSelectedDetail"
        @toggle-face="toggleSelectedFace"
        @toggle-rotation="toggleSelectedRotation"
        @edit-statuses="statusCardId = $event"
        @move-card="moveSelectedCardTo"
      />
    </div>

    <CrawlV3DragGhost
      v-if="dragState?.active && dragPreviewCard"
      :card="dragPreviewCard"
      :style="dragGhostStyle"
      :show-face="dragPreviewShowFace"
      :status-labels="statusLabels"
    />

    <CrawlV3CardTooltip :card="tooltipCard" :point="hoveredTooltip" :buffs="tooltipBuffs" :debuffs="tooltipDebuffs" />

    <CrawlV3DeckModal
      v-if="openPile"
      :title="activePileTitle"
      :cards="activePileCards"
      :interactive="activePileInteractive"
      :allow-move-to-deck="
        (openPile.zone === 'extraDeck' || openPile.zone === 'discard' || openPile.zone === 'exhausted') &&
        activePileInteractive
      "
      :allow-move-to-extra-deck="openPile.zone !== 'extraDeck' && activePileInteractive"
      :allow-move-to-discard="
        (openPile.zone === 'deck' || openPile.zone === 'extraDeck' || openPile.zone === 'exhausted') &&
        activePileInteractive
      "
      :allow-move-to-exhausted="openPile.zone !== 'exhausted' && activePileInteractive"
      :status-labels="statusLabels"
      @close="openPile = null"
      @move-to-hand="moveCardToZone($event, 'hand')"
      @move-to-table="moveCardToZone($event, 'table')"
      @move-to-deck="moveCardToZone($event, 'deck')"
      @move-to-extra-deck="moveCardToZone($event, 'extraDeck')"
      @move-to-discard="moveCardToZone($event, 'discard')"
      @move-to-exhausted="moveCardToZone($event, 'exhausted')"
    />

    <CrawlV3CardPreviewModal
      v-if="previewCard"
      :card="previewCard"
      :show-face="canSeeCardDetails(previewCard)"
      @close="previewCardId = null"
    />

    <CrawlV3StatusModal
      v-if="statusCard"
      :card="statusCard"
      :status-definitions="statusDefinitions"
      @close="statusCardId = null"
      @save="saveSelectedStatuses"
    />

    <CrawlV3ShortcutsModal v-if="shortcutsOpen" @close="shortcutsOpen = false" />
    <CrawlV3RulesModal v-if="rulesOpen" @close="rulesOpen = false" />
  </div>
</template>
