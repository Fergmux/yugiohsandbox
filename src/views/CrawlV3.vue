<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { v4 as uuid } from 'uuid'
import { useRoute, useRouter } from 'vue-router'

import CrawlV3Card from '@/components/crawlv3/CrawlV3Card.vue'
import CrawlV3CardPreviewModal from '@/components/crawlv3/CrawlV3CardPreviewModal.vue'
import CrawlV3DeckModal from '@/components/crawlv3/CrawlV3DeckModal.vue'
import CrawlV3StatusModal from '@/components/crawlv3/CrawlV3StatusModal.vue'
import cardBackImage from '@/assets/images/cards/cardback.png'
import { createDefaultCrawlv3Config, loadCatalogCards, loadStatusDefinitions } from '@/lib/crawlv3/catalog'
import {
  applyCrawlv3Action,
  clampRatio,
  cloneGame,
  getTopDeckCard,
  getTopPileCard,
  getZoneCards,
} from '@/lib/crawlv3/game-state'
import { CRAWLV3_FALLBACK_STATUSES } from '@/lib/crawlv3/status-options'
import { db } from '@/firebase/client'
import { authFetch } from '@/lib/authFetch'
import { useUserStore } from '@/stores/user'
import type {
  Crawlv3Action,
  Crawlv3CatalogCard,
  Crawlv3CatalogConfig,
  Crawlv3CardState,
  Crawlv3Game,
  Crawlv3Player,
  Crawlv3StatusDefinition,
  Crawlv3StatusType,
  Crawlv3Zone,
} from '@/types/crawlv3'

type PendingActionBatch = {
  action: Crawlv3Action
  serverVersion: number | null
}

type QueuedCrawlv3Action =
  | Omit<Extract<Crawlv3Action, { type: 'update_config' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'select_deck' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'set_ready' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'move_card' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'patch_card' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'set_player_stats' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'shuffle_deck' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'shuffle_discard_into_deck' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'complete_game' }>, 'actionId'>

type PileZone = Extract<Crawlv3Zone, 'deck' | 'discard'>

type DragState = {
  instanceId: string
  startX: number
  startY: number
  ghostX: number
  ghostY: number
  cardWidth: number
  active: boolean
}

type TooltipState = {
  cardId: string
  x: number
  y: number
}

type OpenPileState = {
  owner: Crawlv3Player
  zone: PileZone
}

type CardStatusEntry = {
  id: string
  name: string
  description: string
  type: Crawlv3StatusType
  value: number
}

const buttonClasses = {
  neutral:
    'rounded-full border border-white/15 px-3 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5',
  hand: 'rounded-full border border-sky-300/35 bg-sky-300/15 px-3 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-300/55 hover:bg-sky-300/25 disabled:cursor-not-allowed disabled:opacity-50',
  table:
    'rounded-full border border-amber-300/35 bg-amber-300/15 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300/55 hover:bg-amber-300/25 disabled:cursor-not-allowed disabled:opacity-50',
  deck: 'rounded-full border border-indigo-300/35 bg-indigo-300/15 px-3 py-2 text-sm font-semibold text-indigo-100 transition hover:border-indigo-300/55 hover:bg-indigo-300/25 disabled:cursor-not-allowed disabled:opacity-50',
  discard:
    'rounded-full border border-rose-300/35 bg-rose-300/15 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-300/55 hover:bg-rose-300/25 disabled:cursor-not-allowed disabled:opacity-50',
  flip: 'rounded-full border border-emerald-300/35 bg-emerald-300/15 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/55 hover:bg-emerald-300/25 disabled:cursor-not-allowed disabled:opacity-50',
  position:
    'rounded-full border border-orange-300/35 bg-orange-300/15 px-3 py-2 text-sm font-semibold text-orange-100 transition hover:border-orange-300/55 hover:bg-orange-300/25 disabled:cursor-not-allowed disabled:opacity-50',
} as const

const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const gameId = ref<string | null>(null)
const joinCode = ref(String(route.params.gameCode ?? ''))
const loading = ref(false)
const error = ref<string | null>(null)
const boardCardScale = ref(1)
const serverSnapshot = shallowRef<Crawlv3Game | null>(null)
const pendingActions = shallowRef<PendingActionBatch[]>([])
const sendQueue: PendingActionBatch[] = []
let sending = false
let unsubscribeGame: Unsubscribe | null = null

const configDraft = ref<Crawlv3CatalogConfig>(createDefaultCrawlv3Config())
const catalogCards = ref<Crawlv3CatalogCard[]>([])
const catalogLoading = ref(false)
const catalogError = ref<string | null>(null)
const catalogSearch = ref('')
let catalogRequestId = 0

const statusDefinitions = ref<Crawlv3StatusDefinition[]>(cloneGame(CRAWLV3_FALLBACK_STATUSES))
const statusLoading = ref(false)
const statusError = ref<string | null>(null)
let statusRequestId = 0

const selectionDirty = ref(false)
const localSelectionIds = ref<string[]>([])
const configExpanded = ref(false)

const selectedCardId = ref<string | null>(null)
const previewCardId = ref<string | null>(null)
const statusCardId = ref<string | null>(null)
const openPile = ref<OpenPileState | null>(null)
const hoveredTooltip = ref<TooltipState | null>(null)
const dragState = ref<DragState | null>(null)

const statDrafts = ref<Record<Crawlv3Player, { lifePoints: string; actionPoints: string }>>({
  player1: { lifePoints: '8000', actionPoints: '0' },
  player2: { lifePoints: '8000', actionPoints: '0' },
})

const selectedAtk = ref('')
const selectedDef = ref('')

const myPlayer = computed<Crawlv3Player | null>(() => {
  if (!serverSnapshot.value || !userStore.user) return null
  if (serverSnapshot.value.players.player1?.uid === userStore.user.firebaseUid) return 'player1'
  if (serverSnapshot.value.players.player2?.uid === userStore.user.firebaseUid) return 'player2'
  return null
})

const opponentPlayer = computed<Crawlv3Player | null>(() => {
  if (!myPlayer.value) return null
  return myPlayer.value === 'player1' ? 'player2' : 'player1'
})

const game = computed<Crawlv3Game | null>(() => {
  if (!serverSnapshot.value) return null
  let state = cloneGame(serverSnapshot.value)
  for (const batch of pendingActions.value) {
    state = applyCrawlv3Action(state, batch.action, myPlayer.value ?? undefined)
  }
  return state
})

const phase = computed<'join' | 'lobby' | 'game'>(() => {
  if (!game.value) return 'join'
  return game.value.status === 'active' ? 'game' : 'lobby'
})

const isHost = computed(() => myPlayer.value === 'player1')
const isPerspectiveFlipped = computed(() => myPlayer.value === 'player2')

function safeTrim(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

const canLoadSavedCatalog = computed(() => {
  const config = game.value?.config
  return !!safeTrim(config?.csvUrl) && !!safeTrim(config?.headers?.id) && !!safeTrim(config?.headers?.title)
})

const canPreviewCatalogDraft = computed(() => {
  const config = configDraft.value
  return !!safeTrim(config?.csvUrl) && !!safeTrim(config?.headers?.id) && !!safeTrim(config?.headers?.title)
})

const myDeckSelection = computed(() => {
  if (!game.value || !myPlayer.value) return null
  return game.value.deckSelections[myPlayer.value]
})

const isDeckReady = computed(() => !!myDeckSelection.value?.ready)
const canEditDeckSelection = computed(() => !isDeckReady.value)

const selectedCatalogIdSet = computed(() => new Set(localSelectionIds.value))

const selectedCatalogCards = computed(() => {
  const selectedIds = selectedCatalogIdSet.value
  return catalogCards.value.filter((card) => selectedIds.has(card.id))
})

const filteredCatalogCards = computed(() => {
  if (!catalogSearch.value.trim()) return catalogCards.value
  const query = catalogSearch.value.trim().toLowerCase()
  return catalogCards.value.filter((card) =>
    [card.title, card.id, card.category, card.description, card.race, card.damageType]
      .join(' ')
      .toLowerCase()
      .includes(query),
  )
})

const tableCards = computed(() => (game.value ? getZoneCards(game.value.cards, 'table') : []))
const myHandCards = computed(() =>
  game.value && myPlayer.value ? getZoneCards(game.value.cards, 'hand', myPlayer.value) : [],
)
const opponentHandCards = computed(() =>
  game.value && opponentPlayer.value ? getZoneCards(game.value.cards, 'hand', opponentPlayer.value) : [],
)
const myDeckCards = computed(() =>
  game.value && myPlayer.value ? getZoneCards(game.value.cards, 'deck', myPlayer.value) : [],
)
const opponentDeckCards = computed(() =>
  game.value && opponentPlayer.value ? getZoneCards(game.value.cards, 'deck', opponentPlayer.value) : [],
)
const myDiscardCards = computed(() =>
  game.value && myPlayer.value ? getZoneCards(game.value.cards, 'discard', myPlayer.value) : [],
)
const opponentDiscardCards = computed(() =>
  game.value && opponentPlayer.value ? getZoneCards(game.value.cards, 'discard', opponentPlayer.value) : [],
)

const myTopDiscardCard = computed(() =>
  game.value && myPlayer.value ? (getTopPileCard(game.value.cards, 'discard', myPlayer.value) ?? null) : null,
)

const opponentTopDiscardCard = computed(() =>
  game.value && opponentPlayer.value
    ? (getTopPileCard(game.value.cards, 'discard', opponentPlayer.value) ?? null)
    : null,
)

const selectedCard = computed(() => {
  if (!game.value || !selectedCardId.value) return null
  return game.value.cards[selectedCardId.value] ?? null
})

const selectedOwnCard = computed(() => {
  if (!selectedCard.value || !myPlayer.value) return null
  return selectedCard.value.owner === myPlayer.value ? selectedCard.value : null
})

const selectedOwnCardPreview = computed(() => {
  if (!selectedOwnCard.value) return null
  return {
    ...selectedOwnCard.value,
    rotated: false,
  }
})

const tooltipCard = computed(() => {
  if (!game.value || !hoveredTooltip.value) return null
  return game.value.cards[hoveredTooltip.value.cardId] ?? null
})

const previewCard = computed(() => {
  if (!game.value || !previewCardId.value) return null
  return game.value.cards[previewCardId.value] ?? null
})

const statusCard = computed(() => {
  if (!game.value || !statusCardId.value) return null
  return game.value.cards[statusCardId.value] ?? null
})

const statusDefinitionMap = computed(() =>
  Object.fromEntries(statusDefinitions.value.map((status) => [status.id, status])),
)

const statusLabels = computed(() =>
  Object.fromEntries(statusDefinitions.value.map((status) => [status.id, status.name])),
)

const statusPreviewNames = computed(() => statusDefinitions.value.map((status) => status.name || status.id))

const tooltipBuffs = computed(() => (tooltipCard.value ? getCardStatusEntries(tooltipCard.value, 'buff') : []))
const tooltipDebuffs = computed(() => (tooltipCard.value ? getCardStatusEntries(tooltipCard.value, 'debuff') : []))
const boardCardScaleLabel = computed(() => `${Math.round(boardCardScale.value * 100)}%`)

const activePileCards = computed(() => {
  if (!openPile.value || !game.value) return []
  return getZoneCards(game.value.cards, openPile.value.zone, openPile.value.owner)
})

const activePileInteractive = computed(() => !!openPile.value && openPile.value.owner === myPlayer.value)

const activePileTitle = computed(() => {
  if (!game.value || !openPile.value) return ''
  const playerName = game.value.players[openPile.value.owner]?.username ?? 'Player'
  return `${playerName} ${formatZoneLabel(openPile.value.zone)}`
})

const tooltipStyle = computed(() => {
  if (!hoveredTooltip.value) return {}

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0

  return {
    left: `${Math.min(hoveredTooltip.value.x + 18, Math.max(0, viewportWidth - 360))}px`,
    top: `${Math.min(hoveredTooltip.value.y + 18, Math.max(0, viewportHeight - 260))}px`,
  }
})

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
  }
})

function clearTransientUi() {
  hoveredTooltip.value = null
  dragState.value = null
}

function resetStatusDefinitions() {
  statusDefinitions.value = cloneGame(CRAWLV3_FALLBACK_STATUSES)
  statusLoading.value = false
  statusError.value = null
}

function subscribeToGame(id: string) {
  unsubscribeGame?.()
  unsubscribeGame = onSnapshot(doc(db, 'crawlv3_games', id), (snapshot) => {
    const data = snapshot.data() as Crawlv3Game | undefined
    if (!data) return
    serverSnapshot.value = data

    const snapshotVersion = data._version ?? 0
    pendingActions.value = pendingActions.value.filter(
      (batch) => batch.serverVersion === null || batch.serverVersion > snapshotVersion,
    )
  })
}

async function createGame() {
  loading.value = true
  error.value = null

  try {
    const response = await authFetch('/.netlify/functions/create-crawlv3', {
      method: 'POST',
      body: JSON.stringify({
        username: userStore.user?.username,
        config: cloneGame(createDefaultCrawlv3Config()),
      }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message ?? 'Failed to create room')

    gameId.value = data.id
    joinCode.value = String(data.code)
    router.replace({ name: 'crawlv3', params: { gameCode: joinCode.value } })
    subscribeToGame(data.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create room'
  } finally {
    loading.value = false
  }
}

async function joinGame() {
  loading.value = true
  error.value = null

  try {
    const response = await authFetch('/.netlify/functions/join-crawlv3', {
      method: 'POST',
      body: JSON.stringify({
        code: Number(joinCode.value),
        username: userStore.user?.username,
      }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message ?? 'Failed to join room')

    gameId.value = data.id
    joinCode.value = String(data.code ?? joinCode.value)
    serverSnapshot.value = data as Crawlv3Game
    router.replace({ name: 'crawlv3', params: { gameCode: joinCode.value } })
    subscribeToGame(data.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to join room'
  } finally {
    loading.value = false
  }
}

async function flushQueue() {
  if (sending || !sendQueue.length || !gameId.value) return
  sending = true
  const batch = sendQueue.shift()

  if (!batch) {
    sending = false
    return
  }

  try {
    const response = await authFetch('/.netlify/functions/crawlv3-action', {
      method: 'POST',
      body: JSON.stringify({
        gameId: gameId.value,
        action: batch.action,
      }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message ?? 'Action failed')

    batch.serverVersion = data.version ?? null
    const snapshotVersion = serverSnapshot.value?._version ?? 0
    if (batch.serverVersion !== null && batch.serverVersion <= snapshotVersion) {
      pendingActions.value = pendingActions.value.filter((candidate) => candidate !== batch)
    }
  } catch (err) {
    pendingActions.value = pendingActions.value.filter((candidate) => candidate !== batch)
    error.value = err instanceof Error ? err.message : 'Action failed'
  } finally {
    sending = false
    if (sendQueue.length) {
      void flushQueue()
    }
  }
}

function enqueueAction(action: QueuedCrawlv3Action) {
  const fullAction = { ...action, actionId: uuid() } as Crawlv3Action
  const batch: PendingActionBatch = {
    action: fullAction,
    serverVersion: null,
  }
  pendingActions.value = [...pendingActions.value, batch]
  sendQueue.push(batch)
  void flushQueue()
}

function leaveRoom() {
  unsubscribeGame?.()
  unsubscribeGame = null
  sendQueue.length = 0
  pendingActions.value = []
  serverSnapshot.value = null
  gameId.value = null
  joinCode.value = ''
  catalogCards.value = []
  catalogError.value = null
  configDraft.value = createDefaultCrawlv3Config()
  selectionDirty.value = false
  localSelectionIds.value = []
  selectedCardId.value = null
  previewCardId.value = null
  statusCardId.value = null
  openPile.value = null
  configExpanded.value = false
  resetStatusDefinitions()
  clearTransientUi()
  router.replace({ name: 'crawlv3' })
}

function completeGame() {
  enqueueAction({
    type: 'complete_game',
  })
  selectedCardId.value = null
  statusCardId.value = null
  previewCardId.value = null
  openPile.value = null
  clearTransientUi()
}

function shuffleItems<T>(items: T[]) {
  const nextItems = [...items]
  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = nextItems[index]
    nextItems[index] = nextItems[swapIndex]
    nextItems[swapIndex] = current
  }
  return nextItems
}

function updateConfig() {
  enqueueAction({
    type: 'update_config',
    config: cloneGame(configDraft.value),
  })
}

async function reloadCatalog(config = game.value?.config) {
  if (!config || !safeTrim(config?.csvUrl) || !safeTrim(config?.headers?.id) || !safeTrim(config?.headers?.title)) {
    catalogCards.value = []
    catalogError.value = null
    return
  }

  const requestId = ++catalogRequestId
  catalogLoading.value = true
  catalogError.value = null

  try {
    const cards = await loadCatalogCards(config)
    if (requestId !== catalogRequestId) return
    catalogCards.value = cards
  } catch (err) {
    if (requestId !== catalogRequestId) return
    catalogCards.value = []
    catalogError.value = err instanceof Error ? err.message : 'Failed to load the CSV. Check the link and header names.'
  } finally {
    if (requestId === catalogRequestId) {
      catalogLoading.value = false
    }
  }
}

async function reloadStatuses(config = game.value?.config) {
  const requestId = ++statusRequestId
  const hasConfiguredCsv =
    !!safeTrim(config?.statusCsvUrl) &&
    !!safeTrim(config?.statusHeaders?.id) &&
    !!safeTrim(config?.statusHeaders?.name) &&
    !!safeTrim(config?.statusHeaders?.type)

  if (!config || !hasConfiguredCsv) {
    statusDefinitions.value = cloneGame(CRAWLV3_FALLBACK_STATUSES)
    statusLoading.value = false
    statusError.value = null
    return
  }

  statusLoading.value = true
  statusError.value = null

  try {
    const statuses = await loadStatusDefinitions(config)
    if (requestId !== statusRequestId) return
    statusDefinitions.value = statuses.length ? statuses : cloneGame(CRAWLV3_FALLBACK_STATUSES)
  } catch (err) {
    if (requestId !== statusRequestId) return
    statusDefinitions.value = cloneGame(CRAWLV3_FALLBACK_STATUSES)
    statusError.value =
      err instanceof Error ? err.message : 'Failed to load the status CSV. Using fallback buff and debuff definitions.'
  } finally {
    if (requestId === statusRequestId) {
      statusLoading.value = false
    }
  }
}

function toggleCardSelection(cardId: string) {
  if (!canEditDeckSelection.value) return
  selectionDirty.value = true
  if (localSelectionIds.value.includes(cardId)) {
    localSelectionIds.value = localSelectionIds.value.filter((id) => id !== cardId)
    return
  }
  localSelectionIds.value = [...localSelectionIds.value, cardId]
}

function confirmDeckSelection() {
  if (!canEditDeckSelection.value) return
  const confirmedIds = [...localSelectionIds.value]
  enqueueAction({
    type: 'select_deck',
    cards: selectedCatalogCards.value,
  })
  localSelectionIds.value = confirmedIds
  selectionDirty.value = false
}

function setReadyState(ready: boolean) {
  enqueueAction({
    type: 'set_ready',
    ready,
  })
}

function selectAllCatalogCards() {
  if (!canEditDeckSelection.value) return
  selectionDirty.value = true
  localSelectionIds.value = catalogCards.value.map((card) => card.id)
}

function clearCatalogSelection() {
  if (!canEditDeckSelection.value) return
  selectionDirty.value = true
  localSelectionIds.value = []
}

function formatZoneLabel(zone: Crawlv3Zone) {
  switch (zone) {
    case 'table':
      return 'Table'
    case 'hand':
      return 'Hand'
    case 'deck':
      return 'Deck'
    case 'discard':
      return 'Discard'
  }
}

function formatFaceLabel(faceUp: boolean) {
  return faceUp ? 'Face Up' : 'Face Down'
}

function formatPositionLabel(rotated: boolean) {
  return rotated ? 'Defense Position' : 'Attack Position'
}

function getCardRenderFace(card: Crawlv3CardState) {
  if (!myPlayer.value) return card.zone !== 'hand' && card.faceUp
  if (card.zone === 'hand') return card.owner === myPlayer.value
  return card.faceUp
}

function canSeeCardDetails(card: Crawlv3CardState) {
  if (!myPlayer.value) return card.faceUp && card.zone !== 'hand'
  if (card.owner === myPlayer.value) return true
  if (card.zone === 'hand') return false
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
  const width =
    card.zone === 'table'
      ? `calc(clamp(1.75rem, 5.15%, 8.4rem) * ${scale})`
      : card.zone === 'hand'
        ? `calc(clamp(1.6rem, 4.75%, 7.2rem) * ${scale})`
        : undefined

  return {
    left: `${(point.x * 100).toFixed(2)}%`,
    top: `${(point.y * 100).toFixed(2)}%`,
    zIndex: String(card.z),
    transform: 'translate(-50%, -50%)',
    ...(width ? { width } : {}),
  }
}

function selectCard(cardId: string) {
  selectedCardId.value = selectedCardId.value === cardId ? null : cardId
}

function adjustBoardCardScale(delta: number) {
  boardCardScale.value = Math.min(1.5, Math.max(0.65, Number((boardCardScale.value + delta).toFixed(2))))
}

function startCardDrag(card: Crawlv3CardState, event: PointerEvent) {
  if (!myPlayer.value || card.owner !== myPlayer.value || event.button !== 0) return

  const cardElement = event.currentTarget as HTMLElement | null

  event.preventDefault()
  hoveredTooltip.value = null
  dragState.value = {
    instanceId: card.instanceId,
    startX: event.clientX,
    startY: event.clientY,
    ghostX: event.clientX,
    ghostY: event.clientY,
    cardWidth: cardElement?.offsetWidth || cardElement?.getBoundingClientRect().width || 0,
    active: false,
  }

  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
}

function resolveDropTarget(clientX: number, clientY: number) {
  const elements = document.elementsFromPoint(clientX, clientY)

  for (const element of elements) {
    const dropElement = (element as HTMLElement).closest('[data-crawlv3-drop-zone]') as HTMLElement | null
    if (!dropElement) continue

    const zone = dropElement.dataset.crawlv3DropZone as Crawlv3Zone
    const owner = dropElement.dataset.crawlv3Owner as Crawlv3Player | undefined
    const rect = dropElement.getBoundingClientRect()

    if (zone === 'deck' || zone === 'discard') {
      return { zone, owner }
    }

    const rawX = clampRatio((clientX - rect.left) / rect.width)
    const rawY = clampRatio((clientY - rect.top) / rect.height)
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
  if (!dragState.value) return

  const deltaX = event.clientX - dragState.value.startX
  const deltaY = event.clientY - dragState.value.startY

  dragState.value = {
    ...dragState.value,
    ghostX: event.clientX,
    ghostY: event.clientY,
    active: dragState.value.active || Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 6,
  }
}

function handlePointerUp(event: PointerEvent) {
  const currentDrag = dragState.value
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  clearTransientUi()

  if (!currentDrag) return

  const card = game.value?.cards[currentDrag.instanceId]
  if (!card) return

  if (!currentDrag.active) {
    selectCard(card.instanceId)
    return
  }

  const target = resolveDropTarget(event.clientX, event.clientY)
  if (!target || !myPlayer.value) return

  if (
    (target.zone === 'deck' || target.zone === 'discard' || target.zone === 'hand') &&
    target.owner !== myPlayer.value
  ) {
    return
  }

  const entersTableFromAnotherZone = target.zone === 'table' && card.zone !== 'table'
  const tablePlacementPatch = entersTableFromAnotherZone
    ? {
        faceUp: !event.shiftKey,
        rotated: event.shiftKey,
      }
    : {}

  enqueueAction({
    type: 'move_card',
    instanceId: card.instanceId,
    zone: target.zone,
    ...(target.zone === 'deck' || target.zone === 'discard' ? {} : { x: target.x, y: target.y }),
    ...tablePlacementPatch,
  })
}

function defaultZonePosition(zone: Exclude<Crawlv3Zone, 'deck' | 'discard'>) {
  const zoneCards = zone === 'table' ? tableCards.value.length : myHandCards.value.length
  if (zone === 'hand') {
    return {
      x: clampRatio(0.18 + (zoneCards % 6) * 0.13, 0.5),
      y: clampRatio(0.32 + Math.floor(zoneCards / 6) * 0.2, 5),
    }
  }

  return {
    x: clampRatio(0.18 + (zoneCards % 6) * 0.13, 0.5),
    y: clampRatio(0.2 + Math.floor(zoneCards / 6) * 0.17, 0.5),
  }
}

function moveCardToZone(instanceId: string, zone: Crawlv3Zone) {
  if (zone === 'deck' || zone === 'discard') {
    enqueueAction({
      type: 'move_card',
      instanceId,
      zone,
    })
    return
  }

  const position = defaultZonePosition(zone)
  enqueueAction({
    type: 'move_card',
    instanceId,
    zone,
    x: position.x,
    y: position.y,
  })
}

function moveTopPileCardTo(sourceZone: PileZone, targetZone: Crawlv3Zone) {
  if (!myPlayer.value || !game.value) return
  const topCard =
    sourceZone === 'deck'
      ? getTopDeckCard(game.value.cards, myPlayer.value)
      : getTopPileCard(game.value.cards, 'discard', myPlayer.value)

  if (!topCard) return
  moveCardToZone(topCard.instanceId, targetZone)
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

function parseNumericInput(value: string, fallback: number) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

function commitPlayerStats(
  player: Crawlv3Player,
  overrides: Partial<{ lifePoints: number; actionPoints: number }> = {},
) {
  const playerState = game.value?.players[player]
  if (!playerState) return

  const lifePoints =
    overrides.lifePoints ?? parseNumericInput(statDrafts.value[player].lifePoints, playerState.lifePoints)
  const actionPoints =
    overrides.actionPoints ?? parseNumericInput(statDrafts.value[player].actionPoints, playerState.actionPoints)

  statDrafts.value[player] = {
    lifePoints: String(lifePoints),
    actionPoints: String(actionPoints),
  }

  enqueueAction({
    type: 'set_player_stats',
    player,
    lifePoints,
    actionPoints,
  })
}

function savePlayerStats(player: Crawlv3Player) {
  commitPlayerStats(player)
}

function adjustLifePoints(player: Crawlv3Player, delta: number) {
  const playerState = game.value?.players[player]
  if (!playerState) return

  const nextValue = parseNumericInput(statDrafts.value[player].lifePoints, playerState.lifePoints) + delta
  commitPlayerStats(player, { lifePoints: nextValue })
}

function adjustActionPoints(player: Crawlv3Player, delta: number) {
  const playerState = game.value?.players[player]
  if (!playerState) return
  const nextValue = parseNumericInput(statDrafts.value[player].actionPoints, playerState.actionPoints) + delta
  commitPlayerStats(player, { actionPoints: nextValue })
}

function resetActionPoints(player: Crawlv3Player) {
  commitPlayerStats(player, { actionPoints: game.value?.config.defaultActionPoints ?? 0 })
}

function saveSelectedStats() {
  if (!selectedOwnCard.value) return

  enqueueAction({
    type: 'patch_card',
    instanceId: selectedOwnCard.value.instanceId,
    patch: {
      atk: selectedAtk.value,
      def: selectedDef.value,
    },
  })
}

function toggleSelectedFace() {
  if (!selectedOwnCard.value) return
  enqueueAction({
    type: 'patch_card',
    instanceId: selectedOwnCard.value.instanceId,
    patch: {
      faceUp: !selectedOwnCard.value.faceUp,
    },
  })
}

function toggleSelectedRotation() {
  if (!selectedOwnCard.value) return
  enqueueAction({
    type: 'patch_card',
    instanceId: selectedOwnCard.value.instanceId,
    patch: {
      rotated: !selectedOwnCard.value.rotated,
    },
  })
}

function decrementCardStatus(instanceId: string, kind: Crawlv3StatusType, key: string) {
  const card = game.value?.cards[instanceId]
  if (!card || !myPlayer.value || card.owner !== myPlayer.value) return

  const nextRecord = {
    ...(kind === 'buff' ? card.buffs : card.debuffs),
  }

  const nextValue = (nextRecord[key] ?? 0) - 1
  if (nextValue > 0) {
    nextRecord[key] = nextValue
  } else {
    delete nextRecord[key]
  }

  enqueueAction({
    type: 'patch_card',
    instanceId,
    patch: kind === 'buff' ? { buffs: nextRecord } : { debuffs: nextRecord },
  })
}

function saveSelectedStatuses(payload: { buffs: Record<string, number>; debuffs: Record<string, number> }) {
  if (!selectedOwnCard.value) return
  enqueueAction({
    type: 'patch_card',
    instanceId: selectedOwnCard.value.instanceId,
    patch: payload,
  })
  statusCardId.value = null
}

function getCardStatusEntries(card: Crawlv3CardState, type: Crawlv3StatusType): CardStatusEntry[] {
  const source = type === 'buff' ? card.buffs : card.debuffs

  return Object.entries(source)
    .map(([id, value]) => ({
      id,
      name: statusDefinitionMap.value[id]?.name ?? id,
      description: statusDefinitionMap.value[id]?.description ?? '',
      type,
      value,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
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

function openPileViewer(owner: Crawlv3Player, zone: PileZone) {
  openPile.value = { owner, zone }
}

function pilePreviewImage(card: Crawlv3CardState | null) {
  return card?.imageUrl || ''
}

function cardSummary(card: Crawlv3CatalogCard) {
  return [
    card.title,
    `ID: ${card.id}`,
    `Cost: ${card.cost || '-'}`,
    `ATK: ${card.atk || '-'}`,
    `DEF: ${card.def || '-'}`,
    card.category ? `Category: ${card.category}` : '',
    card.race || card.damageType || '',
    card.description || '',
  ]
    .filter(Boolean)
    .join('\n')
}

watch(
  () => serverSnapshot.value?.config,
  (config) => {
    if (!config) return
    configDraft.value = cloneGame(config)
  },
  { immediate: true },
)

watch(
  () => JSON.stringify(myDeckSelection.value?.cards.map((card) => card.id) ?? []),
  (serializedSelection) => {
    if (selectionDirty.value) return
    const nextIds = serializedSelection ? (JSON.parse(serializedSelection) as string[]) : []
    localSelectionIds.value = nextIds
  },
  { immediate: true },
)

watch(
  () => game.value?.players,
  (players) => {
    if (!players) return
    for (const key of ['player1', 'player2'] as const) {
      statDrafts.value[key] = {
        lifePoints: String(players[key]?.lifePoints ?? 0),
        actionPoints: String(players[key]?.actionPoints ?? 0),
      }
    }
  },
  { immediate: true, deep: true },
)

watch(
  () => selectedOwnCard.value,
  (card) => {
    selectedAtk.value = card?.atk ?? ''
    selectedDef.value = card?.def ?? ''
  },
  { immediate: true },
)

watch(
  () => selectedCard.value,
  (card) => {
    if (!card && selectedCardId.value) {
      selectedCardId.value = null
    }
  },
)

watch(
  () => statusCard.value,
  (card) => {
    if (!card && statusCardId.value) {
      statusCardId.value = null
    }
  },
)

watch(
  () => JSON.stringify(game.value?.config ?? {}),
  () => {
    if (phase.value === 'lobby' && canLoadSavedCatalog.value) {
      void reloadCatalog()
    } else if (phase.value !== 'lobby') {
      catalogCards.value = []
      catalogError.value = null
    }

    void reloadStatuses(game.value?.config)
  },
  { immediate: true },
)

onMounted(() => {
  if (route.params.gameCode) {
    joinCode.value = String(route.params.gameCode)
    void joinGame()
  }
})

onBeforeUnmount(() => {
  unsubscribeGame?.()
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
})
</script>

<template>
  <div
    class="min-h-screen bg-[radial-gradient(circle_at_top,#3a1c12_0%,#18110f_40%,#090909_100%)] px-4 pb-12 text-white sm:px-6"
    :style="{ '--crawlv3-card-width': 'clamp(5.3rem, 7.2vw, 8.2rem)' }"
  >
    <div v-if="phase === 'join'" class="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center">
      <div
        class="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-neutral-950/70 p-8 shadow-2xl backdrop-blur-sm"
      >
        <p class="text-xs font-semibold tracking-[0.45em] text-amber-200/60 uppercase">CrawlV3</p>
        <h1 class="mt-4 text-4xl font-semibold text-white">Sandbox Multiplayer</h1>
        <p class="mt-3 max-w-xl text-white/65">
          Create a room, load your card CSV, pick any number of starting cards, and manipulate the sandbox together in
          real time.
        </p>

        <div class="mt-8 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            v-model="joinCode"
            type="number"
            placeholder="Enter room code"
            class="rounded-[1.25rem] border border-white/10 bg-white/5 px-5 py-4 text-lg transition outline-none focus:border-amber-300/50"
            @keyup.enter="joinGame"
          />
          <button
            type="button"
            class="rounded-[1.25rem] border border-sky-300/40 bg-sky-300/15 px-6 py-4 text-lg font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="loading || !joinCode"
            @click="joinGame"
          >
            Join
          </button>
        </div>

        <div class="my-8 flex items-center gap-4 text-sm text-white/35">
          <div class="h-px flex-1 bg-white/10" />
          <span>or</span>
          <div class="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          class="w-full rounded-[1.25rem] bg-amber-300 px-6 py-4 text-lg font-semibold text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="loading"
          @click="createGame"
        >
          Create Room
        </button>

        <p v-if="error" class="mt-4 text-sm text-rose-300">{{ error }}</p>
      </div>
    </div>

    <div v-else-if="phase === 'lobby'" class="mx-auto max-w-7xl py-8">
      <div class="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <aside class="space-y-6">
          <section class="rounded-[1.75rem] border border-white/10 bg-neutral-950/70 p-6 shadow-2xl backdrop-blur-sm">
            <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Room</p>
            <div class="mt-4 flex items-center justify-between gap-4">
              <div>
                <p class="text-sm text-white/55">Code</p>
                <p class="text-4xl font-semibold tracking-[0.22em] text-amber-200">{{ game?.code }}</p>
              </div>
              <button
                type="button"
                class="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
                @click="leaveRoom"
              >
                Leave
              </button>
            </div>

            <div class="mt-6 space-y-3">
              <div
                v-for="playerKey in ['player1', 'player2'] as const"
                :key="playerKey"
                class="rounded-[1.25rem] border px-4 py-4"
                :class="playerKey === myPlayer ? 'border-amber-300/45 bg-amber-300/10' : 'border-white/10 bg-white/5'"
              >
                <p class="text-xs font-semibold tracking-[0.25em] text-white/40 uppercase">
                  {{ playerKey === 'player1' ? 'Host' : 'Player 2' }}
                </p>
                <p class="mt-2 text-lg font-semibold">
                  {{ game?.players[playerKey]?.username ?? 'Waiting for player...' }}
                </p>
                <p class="mt-1 text-sm text-white/55">
                  {{
                    game?.deckSelections[playerKey]?.ready
                      ? 'Ready'
                      : game?.deckSelections[playerKey]
                        ? `${game.deckSelections[playerKey]?.cards.length} cards selected`
                        : 'No deck selected yet'
                  }}
                </p>
              </div>
            </div>
          </section>

          <section class="rounded-[1.75rem] border border-white/10 bg-neutral-950/70 p-6 shadow-2xl backdrop-blur-sm">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Catalog Setup</p>
                <h2 class="mt-2 text-2xl font-semibold">CSV + Images</h2>
              </div>
              <div class="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  class="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
                  @click="configExpanded = !configExpanded"
                >
                  {{ configExpanded ? 'Hide Config' : 'Show Config' }}
                </button>
                <button
                  v-if="isHost && configExpanded"
                  type="button"
                  class="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-200"
                  @click="updateConfig"
                >
                  Save Config
                </button>
              </div>
            </div>

            <div
              v-if="!configExpanded"
              class="mt-5 rounded-[1.25rem] border border-white/10 bg-white/5 p-4 text-sm text-white/60"
            >
              Room config is collapsed by default. Expand it to edit the card CSV, image links, status CSV, and default
              point values.
            </div>

            <div v-else class="mt-5 space-y-4">
              <label class="block">
                <span class="mb-2 block text-sm text-white/65">Card CSV URL</span>
                <input
                  v-model="configDraft.csvUrl"
                  :readonly="!isHost"
                  type="url"
                  placeholder="https://example.com/cards.csv"
                  class="w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 transition outline-none read-only:cursor-default read-only:opacity-80 focus:border-amber-300/50"
                />
              </label>

              <div class="grid gap-3 sm:grid-cols-2">
                <label
                  v-for="[key, label] in [
                    ['id', 'ID header'],
                    ['title', 'Title header'],
                    ['cost', 'Cost header'],
                    ['atk', 'ATK header'],
                    ['def', 'DEF header'],
                    ['category', 'Category header'],
                    ['race', 'Race header'],
                    ['damageType', 'Damage type header'],
                    ['description', 'Description header'],
                  ]"
                  :key="key"
                  class="block"
                >
                  <span class="mb-2 block text-sm text-white/65">{{ label }}</span>
                  <input
                    v-model="configDraft.headers[key as keyof Crawlv3CatalogConfig['headers']]"
                    :readonly="!isHost"
                    type="text"
                    :placeholder="key"
                    class="w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 transition outline-none read-only:cursor-default read-only:opacity-80 focus:border-amber-300/50"
                  />
                </label>
              </div>

              <label class="block">
                <span class="mb-2 block text-sm text-white/65">Image URL template</span>
                <input
                  v-model="configDraft.imageUrlTemplate"
                  :readonly="!isHost"
                  type="text"
                  placeholder="https://cdn.example.com/cards/{id}.png"
                  class="w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 transition outline-none read-only:cursor-default read-only:opacity-80 focus:border-amber-300/50"
                />
                <span class="mt-2 block text-xs text-white/45">
                  Use <code>{id}</code> where the card id should be inserted.
                </span>
              </label>

              <label class="block">
                <span class="mb-2 block text-sm text-white/65">Per-id image overrides</span>
                <textarea
                  v-model="configDraft.imageOverridesText"
                  :readonly="!isHost"
                  rows="5"
                  placeholder="123,https://cdn.example.com/cards/123.png"
                  class="w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 transition outline-none read-only:cursor-default read-only:opacity-80 focus:border-amber-300/50"
                />
              </label>

              <div class="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-white/88">Buff / Debuff CSV</p>
                    <p class="mt-1 text-sm text-white/55">
                      Optional CSV with <code>id</code>, <code>name</code>, <code>type</code>, and
                      <code>description</code> columns.
                    </p>
                  </div>
                  <p class="text-sm text-white/55">
                    {{ statusLoading ? 'Loading status list...' : `${statusDefinitions.length} status entries ready` }}
                  </p>
                </div>

                <div class="mt-4 space-y-4">
                  <label class="block">
                    <span class="mb-2 block text-sm text-white/65">Status CSV URL</span>
                    <input
                      v-model="configDraft.statusCsvUrl"
                      :readonly="!isHost"
                      type="url"
                      placeholder="https://example.com/statuses.csv"
                      class="w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 transition outline-none read-only:cursor-default read-only:opacity-80 focus:border-amber-300/50"
                    />
                  </label>

                  <div class="grid gap-3 sm:grid-cols-2">
                    <label
                      v-for="[key, label] in [
                        ['id', 'Status id header'],
                        ['name', 'Status name header'],
                        ['type', 'Status type header'],
                        ['description', 'Status description header'],
                      ]"
                      :key="key"
                      class="block"
                    >
                      <span class="mb-2 block text-sm text-white/65">{{ label }}</span>
                      <input
                        v-model="configDraft.statusHeaders[key as keyof Crawlv3CatalogConfig['statusHeaders']]"
                        :readonly="!isHost"
                        type="text"
                        :placeholder="key"
                        class="w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 transition outline-none read-only:cursor-default read-only:opacity-80 focus:border-amber-300/50"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <label class="block">
                  <span class="mb-2 block text-sm text-white/65">Default life points</span>
                  <input
                    v-model.number="configDraft.defaultLifePoints"
                    :readonly="!isHost"
                    type="number"
                    class="w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 transition outline-none read-only:cursor-default read-only:opacity-80 focus:border-amber-300/50"
                  />
                </label>
                <label class="block">
                  <span class="mb-2 block text-sm text-white/65">Default action points</span>
                  <input
                    v-model.number="configDraft.defaultActionPoints"
                    :readonly="!isHost"
                    type="number"
                    class="w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 transition outline-none read-only:cursor-default read-only:opacity-80 focus:border-amber-300/50"
                  />
                </label>
              </div>

              <div class="flex flex-wrap gap-3">
                <button
                  type="button"
                  class="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!canPreviewCatalogDraft || catalogLoading"
                  @click="reloadCatalog(configDraft)"
                >
                  {{ catalogLoading ? 'Loading...' : 'Preview Catalog' }}
                </button>
                <button
                  type="button"
                  class="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
                  @click="reloadStatuses(configDraft)"
                >
                  Preview Status List
                </button>
                <p v-if="catalogCards.length" class="self-center text-sm text-emerald-200">
                  {{ catalogCards.length }} cards loaded
                </p>
              </div>

              <div class="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-xs font-semibold tracking-[0.3em] text-white/45 uppercase">Status Preview</p>
                    <p class="mt-1 text-sm text-white/55">
                      {{ statusLoading ? 'Loading status list...' : `${statusPreviewNames.length} status names` }}
                    </p>
                  </div>
                </div>

                <div class="mt-3 flex flex-wrap gap-2">
                  <span
                    v-for="(statusName, statusIndex) in statusPreviewNames"
                    :key="`status-preview-${statusIndex}-${statusName}`"
                    class="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/80"
                  >
                    {{ statusName }}
                  </span>
                </div>

                <p v-if="statusError" class="mt-3 text-sm text-rose-300">{{ statusError }}</p>
              </div>

              <p v-if="catalogError" class="text-sm text-rose-300">{{ catalogError }}</p>
            </div>
          </section>
        </aside>

        <section class="rounded-[1.75rem] border border-white/10 bg-neutral-950/70 p-6 shadow-2xl backdrop-blur-sm">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Deck Selection</p>
              <h2 class="mt-2 text-2xl font-semibold">Pick Starting Cards</h2>
              <p class="mt-2 text-white/60">
                Choose any number of cards, confirm your selection, then ready up once you are happy.
              </p>
            </div>
            <div class="flex flex-wrap gap-3">
              <button
                type="button"
                class="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!canEditDeckSelection"
                @click="selectAllCatalogCards"
              >
                Select All
              </button>
              <button
                type="button"
                class="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!canEditDeckSelection"
                @click="clearCatalogSelection"
              >
                Clear
              </button>
              <button
                v-if="!isDeckReady"
                type="button"
                class="rounded-full border border-sky-300/35 bg-sky-300/15 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-300/50 hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="catalogLoading || !catalogCards.length || !canEditDeckSelection"
                @click="confirmDeckSelection"
              >
                Confirm Selection
              </button>
              <button
                v-if="myDeckSelection && !isDeckReady"
                type="button"
                class="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="selectionDirty"
                @click="setReadyState(true)"
              >
                Ready Up
              </button>
              <button
                v-if="myDeckSelection && isDeckReady"
                type="button"
                class="rounded-full border border-rose-300/35 bg-rose-300/15 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-300/50 hover:bg-rose-300/20"
                @click="setReadyState(false)"
              >
                Unready
              </button>
            </div>
          </div>

          <div class="mt-6 flex flex-wrap items-center gap-3">
            <input
              v-model="catalogSearch"
              type="text"
              placeholder="Search cards"
              class="min-w-[16rem] flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 transition outline-none focus:border-amber-300/50"
            />
            <div class="rounded-full bg-white/5 px-4 py-2 text-sm text-white/70">
              {{ localSelectionIds.length }} selected
            </div>
          </div>

          <div
            v-if="catalogLoading"
            class="mt-8 rounded-[1.25rem] border border-white/10 bg-white/5 p-8 text-center text-white/65"
          >
            Loading catalog...
          </div>

          <div
            v-else-if="!catalogCards.length"
            class="mt-8 rounded-[1.25rem] border border-white/10 bg-white/5 p-8 text-center text-white/65"
          >
            Save the catalog config and load the CSV to start picking cards.
          </div>

          <div v-else class="mt-8 max-h-[clamp(34rem,58vw,56rem)] overflow-y-auto pr-2">
            <div class="grid [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))] gap-4">
              <button
                v-for="(card, cardIndex) in filteredCatalogCards"
                :key="`catalog-${card.id}-${cardIndex}`"
                type="button"
                class="overflow-hidden rounded-[1.4rem] border bg-white/5 text-left transition"
                :class="
                  selectedCatalogIdSet.has(card.id)
                    ? 'border-amber-300/50 bg-amber-300/10'
                    : 'border-white/10 hover:border-white/25 hover:bg-white/10'
                "
                :disabled="!canEditDeckSelection"
                :title="
                  canEditDeckSelection ? cardSummary(card) : `${cardSummary(card)}\n\nUnready to change your selection.`
                "
                @click="toggleCardSelection(card.id)"
              >
                <div class="aspect-[63/88] overflow-hidden bg-black/20">
                  <img v-if="card.imageUrl" :src="card.imageUrl" :alt="card.title" class="h-full w-full object-cover" />
                  <div
                    v-else
                    class="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,#f7e6c0_0%,#ddc48f_35%,#7b5f31_100%)] p-3 text-center text-sm font-semibold text-amber-950"
                  >
                    {{ card.title }}
                  </div>
                </div>

                <div class="flex items-center justify-between gap-3 p-3">
                  <div class="min-w-0">
                    <p class="truncate font-semibold">{{ card.title }}</p>
                    <p class="mt-1 text-xs text-white/50">{{ card.race }} - {{ card.damageType }}</p>
                  </div>
                  <span
                    v-if="selectedCatalogIdSet.has(card.id)"
                    class="rounded-full bg-amber-300 px-2 py-1 text-[0.7rem] font-semibold text-amber-950"
                  >
                    Selected
                  </span>
                </div>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>

    <div v-else-if="phase === 'game' && game && myPlayer && opponentPlayer" class="mx-auto py-6">
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
              <button
                type="button"
                class="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
                @click="openPileViewer(myPlayer, 'deck')"
              >
                View Deck
              </button>
              <button
                type="button"
                class="rounded-full border border-amber-300/35 bg-amber-300/12 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-300/18"
                @click="completeGame"
              >
                Complete Game
              </button>
              <button
                type="button"
                class="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
                @click="leaveRoom"
              >
                Leave Game
              </button>
            </div>
          </header>

          <section class="space-y-4">
            <div class="grid gap-4 xl:grid-cols-3">
              <div
                class="rounded-[1.4rem] border border-white/10 bg-neutral-950/70 p-4 shadow-2xl backdrop-blur-sm"
                data-crawlv3-drop-zone="deck"
                :data-crawlv3-owner="opponentPlayer"
              >
                <div>
                  <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Opponent</p>
                  <h2 class="mt-2 text-2xl font-semibold">{{ game.players[opponentPlayer]?.username }}</h2>
                </div>

                <p class="mt-4 text-xs font-semibold tracking-[0.3em] text-white/45 uppercase">Deck</p>
                <div class="mt-4 flex items-center gap-4">
                  <div class="relative h-28 w-20">
                    <div
                      v-if="!opponentDeckCards.length"
                      class="absolute inset-0 border border-dashed border-white/10 bg-white/5"
                    />
                    <img
                      v-for="depth in Math.min(opponentDeckCards.length, 3)"
                      :key="depth"
                      :src="cardBackImage"
                      alt="Deck pile"
                      class="absolute inset-0 h-full w-full border border-white/10 object-cover shadow-lg"
                      :style="{ transform: `translate(${(depth - 1) * 5}px, ${(depth - 1) * 3}px)` }"
                    />
                  </div>
                  <div>
                    <p class="text-2xl font-semibold">{{ opponentDeckCards.length }}</p>
                  </div>
                </div>
              </div>

              <div
                class="rounded-[1.4rem] border border-white/10 bg-neutral-950/70 p-4 shadow-2xl backdrop-blur-sm"
                data-crawlv3-drop-zone="discard"
                :data-crawlv3-owner="opponentPlayer"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-xs font-semibold tracking-[0.3em] text-white/45 uppercase">Discard</p>
                  </div>
                  <button
                    type="button"
                    class="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
                    @click="openPileViewer(opponentPlayer, 'discard')"
                  >
                    Open
                  </button>
                </div>

                <div class="mt-4 flex items-center gap-4">
                  <div class="relative h-28 w-20 overflow-hidden border border-white/10 bg-black/25 shadow-lg">
                    <img
                      v-if="pilePreviewImage(opponentTopDiscardCard)"
                      :src="pilePreviewImage(opponentTopDiscardCard)"
                      alt="Opponent discard pile"
                      class="h-full w-full object-cover"
                    />
                    <div
                      v-else
                      class="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,#f7e6c0_0%,#ddc48f_35%,#7b5f31_100%)] p-3 text-center text-xs font-semibold text-amber-950"
                    >
                      Discard
                    </div>
                  </div>
                  <div>
                    <p class="text-2xl font-semibold">{{ opponentDiscardCards.length }}</p>
                  </div>
                </div>
              </div>

              <div class="rounded-[1.4rem] border border-white/10 bg-neutral-950/70 p-4 shadow-2xl backdrop-blur-sm">
                <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Opponent Stats</p>

                <div class="mt-4 space-y-3">
                  <div class="space-y-2">
                    <span class="mb-2 block text-sm text-white/60">Life Points</span>
                    <div class="flex flex-wrap items-center gap-2">
                      <input
                        v-model="statDrafts[opponentPlayer].lifePoints"
                        type="number"
                        class="min-w-[7rem] flex-1 rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 transition outline-none focus:border-amber-300/50"
                        @keyup.enter="savePlayerStats(opponentPlayer)"
                        @blur="savePlayerStats(opponentPlayer)"
                      />
                      <button type="button" :class="buttonClasses.neutral" @click="adjustLifePoints(opponentPlayer, -5)">
                        -5
                      </button>
                      <button type="button" :class="buttonClasses.neutral" @click="adjustLifePoints(opponentPlayer, -1)">
                        -1
                      </button>
                      <button type="button" :class="buttonClasses.neutral" @click="adjustLifePoints(opponentPlayer, 1)">
                        +1
                      </button>
                      <button type="button" :class="buttonClasses.neutral" @click="adjustLifePoints(opponentPlayer, 5)">
                        +5
                      </button>
                    </div>
                  </div>
                  <div class="space-y-2">
                    <span class="block text-sm text-white/60">Action Points</span>
                    <div class="flex flex-wrap items-center gap-2">
                      <input
                        v-model="statDrafts[opponentPlayer].actionPoints"
                        type="number"
                        class="min-w-[7rem] flex-1 rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 transition outline-none focus:border-amber-300/50"
                        @keyup.enter="savePlayerStats(opponentPlayer)"
                        @blur="savePlayerStats(opponentPlayer)"
                      />
                      <button
                        type="button"
                        class="rounded-full border border-white/15 px-3 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
                        @click="adjustActionPoints(opponentPlayer, -1)"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        class="rounded-full border border-white/15 px-3 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
                        @click="adjustActionPoints(opponentPlayer, 1)"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        class="rounded-full border border-white/15 px-3 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
                        @click="resetActionPoints(opponentPlayer)"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-[1.75rem] border border-white/10 bg-neutral-950/70 p-3 shadow-2xl backdrop-blur-sm">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Opponent Hand</p>
                  <p class="mt-1 text-sm text-white/55">{{ opponentHandCards.length }} cards</p>
                </div>
              </div>

              <div
                class="relative h-[clamp(10.5rem,15vh,13rem)] overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(135deg,rgba(61,99,114,0.15),rgba(20,22,33,0.65))] ring-1 ring-white/5"
                data-crawlv3-drop-zone="hand"
                :data-crawlv3-owner="opponentPlayer"
              >
                <p v-if="!opponentHandCards.length" class="p-5 text-sm text-white/35">Opponent hand zone</p>

                <div
                  v-for="card in opponentHandCards"
                  :key="card.instanceId"
                  class="absolute"
                  :style="cardPositionStyle(card)"
                >
                  <CrawlV3Card
                    :card="card"
                    fill-parent
                    :show-face="getCardRenderFace(card)"
                    :status-labels="statusLabels"
                    @pointerdown="startCardDrag(card, $event)"
                    @contextmenu.prevent="previewCardId = card.instanceId"
                    @mouseenter="updateTooltip(card, $event)"
                    @mousemove="updateTooltip(card, $event)"
                    @mouseleave="clearTooltip(card)"
                    @decrement-status="decrementCardStatus(card.instanceId, $event.kind, $event.key)"
                  />
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-[1.75rem] border border-white/10 bg-neutral-950/70 p-4 shadow-2xl backdrop-blur-sm">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Shared Table</p>
                <p class="mt-1 text-sm text-white/55">{{ tableCards.length }} cards in play</p>
              </div>
              <div class="flex flex-wrap items-center justify-end gap-3">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-white/45">Card Size {{ boardCardScaleLabel }}</span>
                  <button type="button" :class="buttonClasses.neutral" @click="adjustBoardCardScale(-0.1)">-</button>
                  <button type="button" :class="buttonClasses.neutral" @click="adjustBoardCardScale(0.1)">+</button>
                </div>
                <p class="text-sm text-white/45">Drag your cards anywhere in this zone</p>
              </div>
            </div>

            <div
              class="relative h-[min(50vw,calc(100vh-26rem))] max-h-[68rem] min-h-[38rem] overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(69,46,24,0.22),rgba(20,16,13,0.78)),radial-gradient(circle_at_top,rgba(210,167,93,0.22),transparent_45%)] ring-1 ring-white/5"
              data-crawlv3-drop-zone="table"
            >
              <div
                class="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:calc(100%/10)_calc(100%/8)]"
              />

              <div v-for="card in tableCards" :key="card.instanceId" class="absolute" :style="cardPositionStyle(card)">
                <CrawlV3Card
                  :card="card"
                  fill-parent
                  :show-face="getCardRenderFace(card)"
                  :selected="selectedCardId === card.instanceId"
                  :status-labels="statusLabels"
                  @pointerdown="startCardDrag(card, $event)"
                  @contextmenu.prevent="previewCardId = card.instanceId"
                  @mouseenter="updateTooltip(card, $event)"
                  @mousemove="updateTooltip(card, $event)"
                  @mouseleave="clearTooltip(card)"
                  @decrement-status="decrementCardStatus(card.instanceId, $event.kind, $event.key)"
                />
              </div>
            </div>
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

              <div
                class="relative h-[clamp(10.5rem,15vh,13rem)] overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(135deg,rgba(54,79,55,0.15),rgba(20,22,33,0.65))] ring-1 ring-white/5"
                data-crawlv3-drop-zone="hand"
                :data-crawlv3-owner="myPlayer"
              >
                <p v-if="!myHandCards.length" class="p-5 text-sm text-white/35">Your hand zone</p>

                <div
                  v-for="card in myHandCards"
                  :key="card.instanceId"
                  class="absolute"
                  :style="cardPositionStyle(card)"
                >
                  <CrawlV3Card
                    :card="card"
                    fill-parent
                    :show-face="getCardRenderFace(card)"
                    :selected="selectedCardId === card.instanceId"
                    :status-labels="statusLabels"
                    @pointerdown="startCardDrag(card, $event)"
                    @contextmenu.prevent="previewCardId = card.instanceId"
                    @mouseenter="updateTooltip(card, $event)"
                    @mousemove="updateTooltip(card, $event)"
                    @mouseleave="clearTooltip(card)"
                    @decrement-status="decrementCardStatus(card.instanceId, $event.kind, $event.key)"
                  />
                </div>
              </div>
            </div>

            <div class="grid gap-4 xl:grid-cols-3">
              <div class="rounded-[1.4rem] border border-white/10 bg-neutral-950/70 p-4 shadow-2xl backdrop-blur-sm">
                <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">You</p>
                <h2 class="mt-2 text-2xl font-semibold">{{ game.players[myPlayer]?.username }}</h2>

                <div class="mt-4 space-y-3">
                  <div class="space-y-2">
                    <span class="mb-2 block text-sm text-white/60">Life Points</span>
                    <div class="flex flex-wrap items-center gap-2">
                      <input
                        v-model="statDrafts[myPlayer].lifePoints"
                        type="number"
                        class="min-w-[7rem] flex-1 rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 transition outline-none focus:border-amber-300/50"
                        @keyup.enter="savePlayerStats(myPlayer)"
                        @blur="savePlayerStats(myPlayer)"
                      />
                      <button type="button" :class="buttonClasses.neutral" @click="adjustLifePoints(myPlayer, -5)">
                        -5
                      </button>
                      <button type="button" :class="buttonClasses.neutral" @click="adjustLifePoints(myPlayer, -1)">
                        -1
                      </button>
                      <button type="button" :class="buttonClasses.neutral" @click="adjustLifePoints(myPlayer, 1)">
                        +1
                      </button>
                      <button type="button" :class="buttonClasses.neutral" @click="adjustLifePoints(myPlayer, 5)">
                        +5
                      </button>
                    </div>
                  </div>
                  <div class="space-y-2">
                    <span class="block text-sm text-white/60">Action Points</span>
                    <div class="flex flex-wrap items-center gap-2">
                      <input
                        v-model="statDrafts[myPlayer].actionPoints"
                        type="number"
                        class="min-w-[7rem] flex-1 rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 transition outline-none focus:border-amber-300/50"
                        @keyup.enter="savePlayerStats(myPlayer)"
                        @blur="savePlayerStats(myPlayer)"
                      />
                      <button
                        type="button"
                        class="rounded-full border border-white/15 px-3 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
                        @click="adjustActionPoints(myPlayer, -1)"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        class="rounded-full border border-white/15 px-3 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
                        @click="adjustActionPoints(myPlayer, 1)"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        class="rounded-full border border-white/15 px-3 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
                        @click="resetActionPoints(myPlayer)"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div
                class="rounded-[1.4rem] border border-white/10 bg-neutral-950/70 p-4 shadow-2xl backdrop-blur-sm"
                data-crawlv3-drop-zone="discard"
                :data-crawlv3-owner="myPlayer"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Your Discard</p>
                  </div>
                  <button
                    type="button"
                    class="rounded-full bg-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-950 transition hover:bg-amber-200"
                    @click="openPileViewer(myPlayer, 'discard')"
                  >
                    Open
                  </button>
                </div>

                <div class="mt-4 flex items-center gap-4">
                  <div class="relative h-28 w-20 overflow-hidden border border-white/10 bg-black/25 shadow-lg">
                    <img
                      v-if="pilePreviewImage(myTopDiscardCard)"
                      :src="pilePreviewImage(myTopDiscardCard)"
                      alt="Your discard pile"
                      class="h-full w-full object-cover"
                    />
                    <div
                      v-else
                      class="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,#f7e6c0_0%,#ddc48f_35%,#7b5f31_100%)] p-3 text-center text-xs font-semibold text-amber-950"
                    >
                      Discard
                    </div>
                  </div>
                  <div>
                    <p class="text-2xl font-semibold">{{ myDiscardCards.length }}</p>
                  </div>
                </div>

                <div class="mt-4 flex flex-wrap gap-2">
                  <button type="button" :class="buttonClasses.hand" @click="moveTopPileCardTo('discard', 'hand')">
                    Top to Hand
                  </button>
                  <button type="button" :class="buttonClasses.table" @click="moveTopPileCardTo('discard', 'table')">
                    Top to Table
                  </button>
                  <button
                    type="button"
                    :class="buttonClasses.deck"
                    :disabled="!myDiscardCards.length"
                    @click="shuffleDiscardIntoDeck"
                  >
                    Shuffle Into Deck
                  </button>
                </div>
              </div>

              <div
                class="rounded-[1.4rem] border border-white/10 bg-neutral-950/70 p-4 shadow-2xl backdrop-blur-sm"
                data-crawlv3-drop-zone="deck"
                :data-crawlv3-owner="myPlayer"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Your Deck</p>
                  </div>
                  <button
                    type="button"
                    class="rounded-full bg-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-950 transition hover:bg-amber-200"
                    @click="openPileViewer(myPlayer, 'deck')"
                  >
                    Open
                  </button>
                </div>
                <div class="mt-4 flex items-center gap-4">
                  <div class="relative h-28 w-20">
                    <div
                      v-if="!myDeckCards.length"
                      class="absolute inset-0 border border-dashed border-white/10 bg-white/5"
                    />
                    <img
                      v-for="depth in Math.min(myDeckCards.length, 3)"
                      :key="depth"
                      :src="cardBackImage"
                      alt="Deck pile"
                      class="absolute inset-0 h-full w-full border border-white/10 object-cover shadow-lg"
                      :style="{ transform: `translate(${(depth - 1) * 5}px, ${(depth - 1) * 3}px)` }"
                    />
                  </div>
                  <div>
                    <p class="text-2xl font-semibold">{{ myDeckCards.length }}</p>
                  </div>
                </div>

                <div class="mt-4 flex flex-wrap gap-2">
                  <button type="button" :class="buttonClasses.hand" @click="moveTopPileCardTo('deck', 'hand')">
                    Draw Card
                  </button>
                  <button
                    type="button"
                    class="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
                    @click="shuffleDeck"
                  >
                    Shuffle
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside
          class="rounded-[1.75rem] border border-white/10 bg-neutral-950/70 p-5 shadow-2xl backdrop-blur-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
        >
          <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Selected Card</p>

          <template v-if="selectedOwnCard">
            <div class="mt-4 flex justify-center">
              <CrawlV3Card
                :card="selectedOwnCardPreview ?? selectedOwnCard"
                :show-face="true"
                :status-labels="statusLabels"
                @contextmenu.prevent="previewCardId = selectedOwnCard.instanceId"
                @mouseenter.stop
                @mousemove.stop
                @mouseleave.stop
                @decrement-status="decrementCardStatus(selectedOwnCard.instanceId, $event.kind, $event.key)"
              />
            </div>

            <h2 class="mt-4 text-2xl font-semibold">{{ selectedOwnCard.title }}</h2>
            <p class="mt-1 text-sm text-white/55">
              {{ formatZoneLabel(selectedOwnCard.zone) }} Zone | {{ formatFaceLabel(selectedOwnCard.faceUp) }} |
              {{ formatPositionLabel(selectedOwnCard.rotated) }}
            </p>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="mb-2 block text-sm text-white/60">ATK</span>
                <input
                  v-model="selectedAtk"
                  type="text"
                  class="w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 transition outline-none focus:border-amber-300/50"
                  @keyup.enter="saveSelectedStats"
                  @blur="saveSelectedStats"
                />
              </label>
              <label class="block">
                <span class="mb-2 block text-sm text-white/60">DEF</span>
                <input
                  v-model="selectedDef"
                  type="text"
                  class="w-full rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 transition outline-none focus:border-amber-300/50"
                  @keyup.enter="saveSelectedStats"
                  @blur="saveSelectedStats"
                />
              </label>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <button type="button" :class="buttonClasses.flip" @click="toggleSelectedFace">
                {{ selectedOwnCard.faceUp ? 'Flip Face Down' : 'Flip Face Up' }}
              </button>
              <button type="button" :class="buttonClasses.position" @click="toggleSelectedRotation">
                {{ selectedOwnCard.rotated ? 'Switch to Attack Position' : 'Switch to Defense Position' }}
              </button>
              <button
                type="button"
                :class="buttonClasses.hand"
                @click="moveCardToZone(selectedOwnCard.instanceId, 'hand')"
              >
                Move to Hand
              </button>
              <button
                type="button"
                :class="buttonClasses.table"
                @click="moveCardToZone(selectedOwnCard.instanceId, 'table')"
              >
                Move to Table
              </button>
              <button
                type="button"
                :class="buttonClasses.deck"
                @click="moveCardToZone(selectedOwnCard.instanceId, 'deck')"
              >
                Move to Deck
              </button>
              <button
                type="button"
                :class="buttonClasses.discard"
                @click="moveCardToZone(selectedOwnCard.instanceId, 'discard')"
              >
                Move to Discard
              </button>
              <button
                type="button"
                class="rounded-full bg-amber-300 px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-200"
                @click="statusCardId = selectedOwnCard.instanceId"
              >
                Buffs / Debuffs
              </button>
            </div>

            <div
              v-if="
                getCardStatusEntries(selectedOwnCard, 'buff').length ||
                getCardStatusEntries(selectedOwnCard, 'debuff').length
              "
              class="mt-5 rounded-[1.25rem] border border-white/10 bg-white/5 p-4"
            >
              <p class="text-xs font-semibold tracking-[0.3em] text-white/45 uppercase">Statuses</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <span
                  v-for="status in getCardStatusEntries(selectedOwnCard, 'buff')"
                  :key="`selected-buff-${status.id}`"
                  class="rounded-full bg-emerald-400/85 px-2.5 py-1 text-xs font-semibold text-emerald-950"
                >
                  {{ status.name }} {{ status.value }}
                </span>
                <span
                  v-for="status in getCardStatusEntries(selectedOwnCard, 'debuff')"
                  :key="`selected-debuff-${status.id}`"
                  class="rounded-full bg-rose-400/85 px-2.5 py-1 text-xs font-semibold text-rose-950"
                >
                  {{ status.name }} {{ status.value }}
                </span>
              </div>
            </div>

            <div class="mt-5 rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
              <p class="text-xs font-semibold tracking-[0.3em] text-white/45 uppercase">Description</p>
              <p class="mt-3 text-sm whitespace-pre-wrap text-white/78">
                {{ selectedOwnCard.description || 'No description provided.' }}
              </p>
            </div>
          </template>

          <div v-else class="mt-6 rounded-[1.25rem] border border-white/10 bg-white/5 p-5 text-sm text-white/55">
            Select one of your cards or drag it around the sandbox to edit it here.
          </div>
        </aside>
      </div>
    </div>

    <div
      v-if="dragState && game?.cards[dragState.instanceId]"
      class="pointer-events-none fixed z-[999] -translate-x-1/2 -translate-y-1/2"
      :style="dragGhostStyle"
    >
      <CrawlV3Card
        :card="game.cards[dragState.instanceId]"
        fill-parent
        :show-face="getCardRenderFace(game.cards[dragState.instanceId])"
        :status-labels="statusLabels"
        ghosted
      />
    </div>

    <Teleport to="body">
      <div
        v-if="tooltipCard && hoveredTooltip"
        class="pointer-events-none fixed z-[1000] max-w-sm rounded-[1.25rem] border border-white/10 bg-neutral-950/95 p-4 text-sm text-white shadow-2xl backdrop-blur-sm"
        :style="tooltipStyle"
      >
        <h3 class="text-lg font-semibold">{{ tooltipCard.title }}</h3>
        <p class="mt-1 text-white/60">{{ tooltipCard.category || '-' }}</p>
        <div class="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-white/55">
          <span>Cost {{ tooltipCard.cost || '-' }}</span>
          <span>ATK <span class="text-base font-bold text-white">{{ tooltipCard.atk || '-' }}</span></span>
          <span>DEF <span class="text-base font-bold text-white">{{ tooltipCard.def || '-' }}</span></span>
        </div>
        <p class="mt-1 text-white/55">{{ tooltipCard.race || tooltipCard.damageType || 'No tags' }}</p>
        <p class="mt-3 whitespace-pre-wrap text-white/82">
          {{ tooltipCard.description || 'No description provided.' }}
        </p>

        <div v-if="tooltipBuffs.length || tooltipDebuffs.length" class="mt-4 space-y-3">
          <div v-if="tooltipBuffs.length">
            <p class="text-xs font-semibold tracking-[0.25em] text-emerald-200/80 uppercase">Buffs</p>
            <div class="mt-2 space-y-2">
              <div v-for="status in tooltipBuffs" :key="`tooltip-buff-${status.id}`" class="text-white/80">
                <p class="font-semibold text-emerald-200">{{ status.name }} {{ status.value }}</p>
                <p v-if="status.description" class="text-xs text-white/55">{{ status.description }}</p>
              </div>
            </div>
          </div>

          <div v-if="tooltipDebuffs.length">
            <p class="text-xs font-semibold tracking-[0.25em] text-rose-200/80 uppercase">Debuffs</p>
            <div class="mt-2 space-y-2">
              <div v-for="status in tooltipDebuffs" :key="`tooltip-debuff-${status.id}`" class="text-white/80">
                <p class="font-semibold text-rose-200">{{ status.name }} {{ status.value }}</p>
                <p v-if="status.description" class="text-xs text-white/55">{{ status.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <CrawlV3DeckModal
      v-if="openPile"
      :title="activePileTitle"
      :cards="activePileCards"
      :interactive="activePileInteractive"
      :allow-move-to-deck="openPile.zone === 'discard' && activePileInteractive"
      :allow-move-to-discard="openPile.zone === 'deck' && activePileInteractive"
      :status-labels="statusLabels"
      @close="openPile = null"
      @move-to-hand="moveCardToZone($event, 'hand')"
      @move-to-table="moveCardToZone($event, 'table')"
      @move-to-deck="moveCardToZone($event, 'deck')"
      @move-to-discard="moveCardToZone($event, 'discard')"
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

    <p
      v-if="error"
      class="fixed right-4 bottom-4 z-[1000] rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-2xl"
    >
      {{ error }}
    </p>
  </div>
</template>
