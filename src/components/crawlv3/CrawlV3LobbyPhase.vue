<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import CrawlV3CatalogConfigPanel from '@/components/crawlv3/CrawlV3CatalogConfigPanel.vue'
import CrawlV3CardPreviewModal from '@/components/crawlv3/CrawlV3CardPreviewModal.vue'
import CrawlV3CatalogTooltip from '@/components/crawlv3/CrawlV3CatalogTooltip.vue'
import CrawlV3DeckSelectionSidebar from '@/components/crawlv3/CrawlV3DeckSelectionSidebar.vue'
import CrawlV3LobbyRoomPanel from '@/components/crawlv3/CrawlV3LobbyRoomPanel.vue'
import CrawlV3SpectatorDeckSelections from '@/components/crawlv3/CrawlV3SpectatorDeckSelections.vue'
import CrawlV3Select from '@/components/crawlv3/CrawlV3Select.vue'
import { useCrawlv3Catalog } from '@/composables/crawlv3/useCrawlv3Catalog'
import { useCrawlv3Controller } from '@/composables/crawlv3/useCrawlv3Controller'
import { getCardTags } from '@/lib/crawlv3/card-display'
import { getSelectedCardRows, type Crawlv3SelectedCardRow } from '@/lib/crawlv3/selected-card-rows'
import { createCatalogPreviewCardState, safeTrim } from '@/lib/crawlv3/ui-utils'
import type { Crawlv3CatalogCard, Crawlv3LobbyViewState, Crawlv3Player } from '@/types/crawlv3'
import type { Crawlv3SpectatorPerspective } from '@/types/crawlv3-ui'

const {
  game,
  currentUserUid,
  myPlayer,
  isSpectator,
  isHost,
  serverSnapshot,
  phase,
  spectatorPerspective,
  enqueueAction,
  resetRoomSession,
  myDeckSelection,
  isDeckReady,
  canEditDeckSelection,
  setReadyState,
  saveSpectatorPerspective,
} = useCrawlv3Controller()

const {
  statusDefinitions,
  statusLoading,
  statusError,
  catalogLoading,
  catalogCards,
  catalogError,
  configDraft,
  resetCatalogState,
  updateConfig,
  reloadCatalog,
  reloadStatuses,
} = useCrawlv3Catalog({
  game,
  serverSnapshot,
  phase,
  enqueueAction,
})

const catalogSearch = ref('')
const catalogCostFilter = ref('')
const catalogRaceFilter = ref('')
const catalogTypeFilter = ref('')
const catalogCategoryFilter = ref('')
const catalogSortField = ref<'default' | 'cost' | 'atk' | 'def'>('default')
const catalogSortDirection = ref<'asc' | 'desc'>('asc')
const localSelectionIds = ref<string[]>([])
const configExpanded = ref(false)
const draftMode = ref<'catalog' | 'categories' | 'choices'>('catalog')
const draftCategory = ref('')
const draftChoices = ref<Crawlv3CatalogCard[]>([])
const catalogPreviewCard = ref<Crawlv3CatalogCard | null>(null)
const catalogTooltipCard = ref<Crawlv3CatalogCard | null>(null)
const catalogTooltipPoint = ref<{ x: number; y: number } | null>(null)

function createDefaultLobbyViewState(): Crawlv3LobbyViewState {
  return {
    draftMode: 'catalog',
    draftCategory: '',
    draftChoiceIds: [],
  }
}

const spectatorPerspectiveOptions = computed<{ value: Crawlv3SpectatorPerspective; label: string }[]>(() => [
  { value: 'both', label: 'Both' },
  { value: 'player1', label: game.value?.players.player1?.username ?? 'Player 1' },
  { value: 'player2', label: game.value?.players.player2?.username ?? 'Player 2' },
])

const mirroredPlayer = computed<Crawlv3Player | null>(() => {
  if (!isSpectator.value) return null
  return spectatorPerspective.value === 'player1' || spectatorPerspective.value === 'player2'
    ? spectatorPerspective.value
    : null
})
const isMirroringPlayerLobby = computed(() => !!mirroredPlayer.value)
const activePlayer = computed<Crawlv3Player | null>(() => mirroredPlayer.value ?? myPlayer.value)
const activePlayerName = computed(() => {
  const player = activePlayer.value
  return player ? (game.value?.players[player]?.username ?? 'player') : 'player'
})
const activeCanEditDeckSelection = computed(() => !isSpectator.value && canEditDeckSelection.value)
const canHighlightActiveCards = computed(() => isMirroringPlayerLobby.value && !!activePlayer.value)

const activeLobbyState = computed<Crawlv3LobbyViewState>(() => {
  const player = activePlayer.value
  if (!player) return createDefaultLobbyViewState()

  return game.value?.lobbyStates?.[player] ?? createDefaultLobbyViewState()
})

const canPreviewCatalogDraft = computed(() => {
  const config = configDraft.value
  return !!safeTrim(config?.csvUrl) && !!safeTrim(config?.headers?.id) && !!safeTrim(config?.headers?.title)
})

const activeSelectionIds = computed(() => {
  const player = activePlayer.value
  if (!player) return []
  if (!isMirroringPlayerLobby.value) return localSelectionIds.value

  return game.value?.deckSelections[player]?.cards.map((card) => card.id) ?? []
})

const selectedCatalogCounts = computed(() =>
  activeSelectionIds.value.reduce<Record<string, number>>((counts, cardId) => {
    counts[cardId] = (counts[cardId] ?? 0) + 1
    return counts
  }, {}),
)

const selectedCatalogRows = computed(() => {
  const player = activePlayer.value
  if (isMirroringPlayerLobby.value && player) {
    return getSelectedCardRows(game.value?.deckSelections[player]?.cards)
  }

  const counts = selectedCatalogCounts.value
  return catalogCards.value.map((card) => ({ card, count: counts[card.id] ?? 0 })).filter((row) => row.count > 0)
})

const playerSelectionRows = computed<Record<'player1' | 'player2', Crawlv3SelectedCardRow[]>>(() => ({
  player1: getSelectedCardRows(game.value?.deckSelections.player1?.cards),
  player2: getSelectedCardRows(game.value?.deckSelections.player2?.cards),
}))

function splitCatalogValues(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function getUniqueCatalogOptions(getValues: (card: Crawlv3CatalogCard) => string[]) {
  return [...new Set(catalogCards.value.flatMap(getValues))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
}

const costFilterOptions = computed(() => getUniqueCatalogOptions((card) => [card.cost.trim()]))
const raceFilterOptions = computed(() => getUniqueCatalogOptions((card) => splitCatalogValues(card.race)))
const typeFilterOptions = computed(() => getUniqueCatalogOptions((card) => splitCatalogValues(card.damageType)))
const categoryFilterOptions = computed(() => getUniqueCatalogOptions((card) => splitCatalogValues(card.category)))
const costSelectOptions = computed(() => [
  { value: '', label: 'Any' },
  ...costFilterOptions.value.map((option) => ({ value: option, label: option })),
])
const raceSelectOptions = computed(() => [
  { value: '', label: 'Any' },
  ...raceFilterOptions.value.map((option) => ({ value: option, label: option })),
])
const typeSelectOptions = computed(() => [
  { value: '', label: 'Any' },
  ...typeFilterOptions.value.map((option) => ({ value: option, label: option })),
])
const categorySelectOptions = computed(() => [
  { value: '', label: 'Any' },
  ...categoryFilterOptions.value.map((option) => ({ value: option, label: option })),
])
const draftCategoryRows = computed(() =>
  categoryFilterOptions.value.map((category) => ({
    category,
    count: catalogCards.value.filter((card) => splitCatalogValues(card.category).includes(category)).length,
  })),
)
const selectedCategoryRows = computed(() =>
  (isMirroringPlayerLobby.value
    ? [...new Set(selectedCatalogRows.value.flatMap(({ card }) => splitCatalogValues(card.category)))].sort(
        (left, right) => left.localeCompare(right, undefined, { numeric: true }),
      )
    : categoryFilterOptions.value
  ).map((category) => ({
    category,
    count: selectedCatalogRows.value.reduce((total, { card, count }) => {
      if (!splitCatalogValues(card.category).includes(category)) return total
      return total + count
    }, 0),
  })),
)
const sortSelectOptions = [
  { value: 'default', label: 'Default' },
  { value: 'cost', label: 'Cost' },
  { value: 'atk', label: 'ATK' },
  { value: 'def', label: 'DEF' },
]
const sortDirectionOptions = [
  { value: 'asc', label: 'Increasing' },
  { value: 'desc', label: 'Decreasing' },
]

function getCatalogSearchRank(card: Crawlv3CatalogCard, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return 0
  if (card.title.toLowerCase().includes(normalizedQuery)) return 0
  if (card.id.toLowerCase().includes(normalizedQuery)) return 1
  if ([card.category, card.race, card.damageType].join(' ').toLowerCase().includes(normalizedQuery)) {
    return 2
  }
  if (card.description.toLowerCase().includes(normalizedQuery)) return 3
  return null
}

const filteredCatalogCards = computed(() => {
  const query = catalogSearch.value.trim().toLowerCase()
  const hasSearch = query.length > 0
  const sortField = catalogSortField.value

  return catalogCards.value
    .map((card, index) => ({ card, index, rank: hasSearch ? getCatalogSearchRank(card, query) : 0 }))
    .filter((result): result is { card: Crawlv3CatalogCard; index: number; rank: number } => result.rank !== null)
    .filter(({ card }) => {
      if (catalogCostFilter.value && card.cost.trim() !== catalogCostFilter.value) return false
      if (catalogRaceFilter.value && !splitCatalogValues(card.race).includes(catalogRaceFilter.value)) return false
      if (catalogTypeFilter.value && !splitCatalogValues(card.damageType).includes(catalogTypeFilter.value))
        return false
      if (catalogCategoryFilter.value && !splitCatalogValues(card.category).includes(catalogCategoryFilter.value)) {
        return false
      }
      return true
    })
    .sort((left, right) => {
      if (sortField !== 'default') {
        const direction = catalogSortDirection.value === 'asc' ? 1 : -1
        const leftValue = Number(left.card[sortField])
        const rightValue = Number(right.card[sortField])
        const leftSortable = Number.isFinite(leftValue) ? leftValue : Number.POSITIVE_INFINITY
        const rightSortable = Number.isFinite(rightValue) ? rightValue : Number.POSITIVE_INFINITY
        const result = leftSortable - rightSortable || left.card.title.localeCompare(right.card.title)
        if (result) return result * direction
      }

      return left.rank - right.rank || left.index - right.index
    })
    .map((result) => result.card)
})

const activeDraftChoices = computed(() => {
  const cardsById = getCatalogCardsById()
  const choiceIds = activeLobbyState.value.draftChoiceIds
  const stateChoices = choiceIds
    .map((cardId) => cardsById.get(cardId))
    .filter((card): card is Crawlv3CatalogCard => !!card)

  if (stateChoices.length === choiceIds.length) return stateChoices
  if (!isMirroringPlayerLobby.value && activePlayer.value === myPlayer.value) return draftChoices.value

  return []
})

const highlightedCatalogCardIds = computed(() => {
  const selections = game.value?.lobbyCardSelections ?? {}
  const highlightedIds = new Set<string>()

  for (const [uid, selection] of Object.entries(selections)) {
    if (!selection || typeof selection !== 'object' || typeof selection.cardId !== 'string') continue
    const visibleTo = Array.isArray(selection.visibleTo) ? selection.visibleTo : []
    if (uid === currentUserUid.value || (myPlayer.value && visibleTo.includes(myPlayer.value))) {
      highlightedIds.add(selection.cardId)
    }
  }

  return highlightedIds
})

const catalogPreviewState = computed(() => {
  const card = catalogPreviewCard.value
  if (!card) return null

  return createCatalogPreviewCardState(card, activePlayer.value ?? 'player1')
})

const canReadyUp = computed(() => canEditDeckSelection.value && !!localSelectionIds.value.length)

function saveLobbyViewState(state: Crawlv3LobbyViewState) {
  draftMode.value = state.draftMode
  draftCategory.value = state.draftCategory
  draftChoices.value = state.draftChoiceIds
    .map((cardId) => getCatalogCardsById().get(cardId))
    .filter((card): card is Crawlv3CatalogCard => !!card)

  if (!myPlayer.value || isSpectator.value) return

  enqueueAction({
    type: 'update_lobby_state',
    state,
  })
}

function resetDraftCardsState() {
  saveLobbyViewState(createDefaultLobbyViewState())
}

function resetLobbyCatalogState() {
  localSelectionIds.value = []
  configExpanded.value = false
  resetDraftCardsState()
  catalogPreviewCard.value = null
  catalogTooltipCard.value = null
  catalogTooltipPoint.value = null
}

function leaveRoom() {
  resetRoomSession()
  resetCatalogState()
  resetLobbyCatalogState()
}

function addCardSelection(cardId: string) {
  if (!canEditDeckSelection.value) return
  saveDeckSelection([...localSelectionIds.value, cardId])
}

function removeCardSelection(cardId: string) {
  if (!canEditDeckSelection.value) return
  const removeIndex = localSelectionIds.value.lastIndexOf(cardId)
  if (removeIndex === -1) return
  saveDeckSelection(localSelectionIds.value.filter((_, index) => index !== removeIndex))
}

function saveDeckSelection(cardIds: string[]) {
  if (!canEditDeckSelection.value) return
  const cardsById = getCatalogCardsById()
  localSelectionIds.value = cardIds
  enqueueAction({
    type: 'select_deck',
    cards: cardIds.map((cardId) => cardsById.get(cardId)).filter((card): card is Crawlv3CatalogCard => !!card),
  })
}

function getCatalogCardsById() {
  return new Map(catalogCards.value.map((card) => [card.id, card]))
}

function refreshSavedDeckSelectionFromCatalog() {
  if (
    !canEditDeckSelection.value ||
    !myDeckSelection.value ||
    !localSelectionIds.value.length ||
    !catalogCards.value.length
  ) {
    return
  }

  const cardsById = getCatalogCardsById()
  const nextCards = localSelectionIds.value
    .map((cardId) => cardsById.get(cardId))
    .filter((card): card is Crawlv3CatalogCard => !!card)

  if (nextCards.length !== localSelectionIds.value.length) return
  if (JSON.stringify(nextCards) === JSON.stringify(myDeckSelection.value.cards)) return

  enqueueAction({
    type: 'select_deck',
    cards: nextCards,
  })
}

function clearCatalogSelection() {
  if (!canEditDeckSelection.value) return
  saveDeckSelection([])
}

function highlightCardForViewedPlayer(cardId: string) {
  const player = mirroredPlayer.value
  if (!player) return

  enqueueAction({
    type: 'select_lobby_card',
    cardId,
    visibleTo: [player],
  })
}

function handleCatalogCardClick(card: Crawlv3CatalogCard) {
  if (isMirroringPlayerLobby.value) {
    highlightCardForViewedPlayer(card.id)
    return
  }

  addCardSelection(card.id)
}

function handleSelectedCardRowClick(card: Crawlv3CatalogCard) {
  if (isMirroringPlayerLobby.value) {
    highlightCardForViewedPlayer(card.id)
    return
  }

  removeCardSelection(card.id)
}

function savePerspective(value: string) {
  if (value !== 'both' && value !== 'player1' && value !== 'player2') return
  saveSpectatorPerspective(value)
}

function clearCatalogSearch() {
  catalogSearch.value = ''
}

function startDraftCards() {
  if (!canEditDeckSelection.value || !catalogCards.value.length) return
  saveLobbyViewState({
    draftMode: 'categories',
    draftCategory: '',
    draftChoiceIds: [],
  })
  clearCatalogTooltip()
}

function finishDraftCards() {
  resetDraftCardsState()
  clearCatalogTooltip()
}

function getDraftCardsForCategory(category: string) {
  return catalogCards.value.filter((card) => splitCatalogValues(card.category).includes(category))
}

function getRandomDraftChoices(cards: Crawlv3CatalogCard[]) {
  const shuffledCards = [...cards]
  for (let index = shuffledCards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const currentCard = shuffledCards[index]
    shuffledCards[index] = shuffledCards[swapIndex]
    shuffledCards[swapIndex] = currentCard
  }
  return shuffledCards.slice(0, 3)
}

function chooseDraftCategory(category: string) {
  if (!canEditDeckSelection.value) return
  const choices = getRandomDraftChoices(getDraftCardsForCategory(category))
  if (!choices.length) return
  draftChoices.value = choices
  saveLobbyViewState({
    draftMode: 'choices',
    draftCategory: category,
    draftChoiceIds: choices.map((card) => card.id),
  })
  clearCatalogTooltip()
}

function returnToDraftCategories() {
  saveLobbyViewState({
    draftMode: 'categories',
    draftCategory: '',
    draftChoiceIds: [],
  })
  clearCatalogTooltip()
}

function selectDraftCard(card: Crawlv3CatalogCard) {
  if (isMirroringPlayerLobby.value) {
    highlightCardForViewedPlayer(card.id)
    return
  }

  addCardSelection(card.id)
  returnToDraftCategories()
}

function updateCatalogTooltip(card: Crawlv3CatalogCard, event: MouseEvent) {
  catalogTooltipCard.value = card
  catalogTooltipPoint.value = {
    x: event.clientX,
    y: event.clientY,
  }
}

function clearCatalogTooltip(card?: Crawlv3CatalogCard) {
  if (!card || catalogTooltipCard.value?.id === card.id) {
    catalogTooltipCard.value = null
    catalogTooltipPoint.value = null
  }
}

watch(
  () => JSON.stringify(myDeckSelection.value?.cards.map((card) => card.id) ?? []),
  (serializedSelection) => {
    const nextIds = serializedSelection ? (JSON.parse(serializedSelection) as string[]) : []
    localSelectionIds.value = nextIds
    refreshSavedDeckSelectionFromCatalog()
  },
  { immediate: true },
)

watch(
  () => JSON.stringify(catalogCards.value),
  () => {
    refreshSavedDeckSelectionFromCatalog()
  },
)
</script>

<template>
  <div class="mx-auto max-w-400 py-8">
    <div class="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)_minmax(16rem,19rem)]">
      <aside class="space-y-6">
        <CrawlV3LobbyRoomPanel :game="game" :my-player="myPlayer" @leave="leaveRoom" />
        <CrawlV3CatalogConfigPanel
          v-model:expanded="configExpanded"
          v-model:config="configDraft"
          :is-host="isHost"
          :can-preview-catalog="canPreviewCatalogDraft"
          :catalog-loading="catalogLoading"
          :catalog-count="catalogCards.length"
          :catalog-error="catalogError"
          :status-definitions="statusDefinitions"
          :status-loading="statusLoading"
          :status-error="statusError"
          @save-config="updateConfig"
          @preview-catalog="reloadCatalog(configDraft)"
          @preview-statuses="reloadStatuses(configDraft)"
        />
      </aside>
      <section
        class="rounded-[1.75rem] border border-white/10 bg-neutral-950/70 p-6 shadow-2xl backdrop-blur-sm"
        :class="isSpectator && !isMirroringPlayerLobby ? 'xl:col-span-2' : ''"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Deck Selection</p>
            <h2 class="mt-2 text-2xl font-semibold">
              {{ isSpectator ? 'Spectator View' : 'Pick Starting Cards' }}
            </h2>
            <p v-if="!isSpectator" class="mt-2 text-white/60">
              Choose any number of cards. Changes save automatically, so ready up once you are happy.
            </p>
            <p v-else-if="!isMirroringPlayerLobby" class="mt-2 text-white/60">
              Choose a player to mirror their lobby, or choose Both to compare selected decks.
            </p>
            <p v-else class="mt-2 text-white/60">
              Mirroring {{ activePlayerName }}. Click a card to highlight it for them.
            </p>
          </div>
          <div v-if="!isSpectator" class="flex flex-wrap gap-3">
            <button
              v-if="activeLobbyState.draftMode === 'catalog'"
              type="button"
              class="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!activeCanEditDeckSelection || !catalogCards.length"
              @click="startDraftCards"
            >
              Draft Cards
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!activeCanEditDeckSelection"
              @click="clearCatalogSelection"
            >
              Clear Selection
            </button>
            <button
              v-if="!isDeckReady"
              type="button"
              class="cursor-pointer rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canReadyUp"
              @click="setReadyState(true)"
            >
              Ready Up
            </button>
            <button
              v-if="myDeckSelection && isDeckReady"
              type="button"
              class="cursor-pointer rounded-full border border-rose-300/35 bg-rose-300/15 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-300/50 hover:bg-rose-300/20"
              @click="setReadyState(false)"
            >
              Unready
            </button>
          </div>
          <div v-else-if="isMirroringPlayerLobby" class="min-w-48">
            <label class="block">
              <span class="mb-2 block text-sm text-white/65">Spectate</span>
              <CrawlV3Select
                v-model="spectatorPerspective"
                :options="spectatorPerspectiveOptions"
                @change="savePerspective"
              />
            </label>
          </div>
        </div>

        <template v-if="isSpectator && !isMirroringPlayerLobby">
          <CrawlV3SpectatorDeckSelections
            v-model:perspective="spectatorPerspective"
            :game="game"
            :perspective-options="spectatorPerspectiveOptions"
            :player-selection-rows="playerSelectionRows"
            @preview="catalogPreviewCard = $event"
            @save-perspective="saveSpectatorPerspective"
          />
        </template>
        <template v-else>
          <div
            v-if="activeLobbyState.draftMode === 'catalog' && !isMirroringPlayerLobby"
            class="mt-6 flex flex-wrap items-center gap-3"
          >
            <input
              v-model="catalogSearch"
              type="text"
              placeholder="Search cards"
              class="min-w-[16rem] flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 transition outline-none focus:border-amber-300/50"
            />
            <button
              type="button"
              class="cursor-pointer rounded-full border border-white/15 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!catalogSearch"
              @click="clearCatalogSearch"
            >
              Clear
            </button>
          </div>

          <div
            v-if="activeLobbyState.draftMode === 'catalog' && !isMirroringPlayerLobby"
            class="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6"
          >
            <label class="block">
              <span class="mb-2 block text-xs font-semibold tracking-[0.2em] text-white/45 uppercase">Cost</span>
              <CrawlV3Select v-model="catalogCostFilter" :options="costSelectOptions" />
            </label>
            <label class="block">
              <span class="mb-2 block text-xs font-semibold tracking-[0.2em] text-white/45 uppercase">Race</span>
              <CrawlV3Select v-model="catalogRaceFilter" :options="raceSelectOptions" />
            </label>
            <label class="block">
              <span class="mb-2 block text-xs font-semibold tracking-[0.2em] text-white/45 uppercase">Type</span>
              <CrawlV3Select v-model="catalogTypeFilter" :options="typeSelectOptions" />
            </label>
            <label class="block">
              <span class="mb-2 block text-xs font-semibold tracking-[0.2em] text-white/45 uppercase">Category</span>
              <CrawlV3Select v-model="catalogCategoryFilter" :options="categorySelectOptions" />
            </label>
            <label class="block">
              <span class="mb-2 block text-xs font-semibold tracking-[0.2em] text-white/45 uppercase">Sort</span>
              <CrawlV3Select v-model="catalogSortField" :options="sortSelectOptions" />
            </label>
            <label class="block">
              <span class="mb-2 block text-xs font-semibold tracking-[0.2em] text-white/45 uppercase">Direction</span>
              <CrawlV3Select
                v-model="catalogSortDirection"
                :options="sortDirectionOptions"
                :disabled="catalogSortField === 'default'"
              />
            </label>
          </div>

          <div
            v-if="catalogLoading && !catalogCards.length"
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

          <div
            v-else-if="activeLobbyState.draftMode === 'categories'"
            class="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="text-xs font-semibold tracking-[0.35em] text-amber-200/70 uppercase">Draft Cards</p>
                <h3 class="mt-2 text-2xl font-semibold">Choose a Category</h3>
                <p v-if="!isMirroringPlayerLobby" class="mt-2 text-sm text-white/60">
                  Pick a category to see three random cards from it. Selecting a card adds it to your deck.
                </p>
                <p v-else class="mt-2 text-sm text-white/60">
                  Waiting for {{ activePlayerName }} to choose a draft category.
                </p>
              </div>
              <button
                type="button"
                class="cursor-pointer rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!activeCanEditDeckSelection"
                @click="finishDraftCards"
              >
                Finished
              </button>
            </div>

            <div
              v-if="!draftCategoryRows.length"
              class="mt-6 rounded-[1.25rem] border border-white/10 bg-black/20 p-6 text-center text-white/60"
            >
              No card categories were found in the loaded catalog.
            </div>

            <div v-else class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <button
                v-for="{ category, count } in draftCategoryRows"
                :key="`draft-category-${category}`"
                type="button"
                class="cursor-pointer rounded-[1.25rem] border border-white/10 bg-black/20 p-4 text-left transition hover:border-amber-300/45 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!activeCanEditDeckSelection"
                @click="chooseDraftCategory(category)"
              >
                <span class="block text-lg font-semibold text-white">{{ category }}</span>
                <span class="mt-1 block text-sm text-white/55">{{ count }} cards</span>
              </button>
            </div>
          </div>

          <div
            v-else-if="activeLobbyState.draftMode === 'choices'"
            class="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="text-xs font-semibold tracking-[0.35em] text-amber-200/70 uppercase">
                  {{ activeLobbyState.draftCategory }}
                </p>
                <h3 class="mt-2 text-2xl font-semibold">Pick One Card</h3>
                <p v-if="!isMirroringPlayerLobby" class="mt-2 text-sm text-white/60">
                  Choose one of these random cards, or skip this draft pick.
                </p>
                <p v-else class="mt-2 text-sm text-white/60">Click one of these cards to highlight it.</p>
              </div>
              <button
                type="button"
                class="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!activeCanEditDeckSelection"
                @click="returnToDraftCategories"
              >
                Skip
              </button>
            </div>

            <div
              v-if="!activeDraftChoices.length"
              class="mt-6 rounded-[1.25rem] border border-white/10 bg-black/20 p-6 text-center text-white/60"
            >
              No draft choices are visible for this pick.
            </div>

            <div v-else class="mt-6 grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4">
              <div
                v-for="card in activeDraftChoices"
                :key="`draft-choice-${card.id}`"
                class="relative overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/20 transition hover:border-amber-300/45 hover:bg-amber-300/10"
                :class="highlightedCatalogCardIds.has(card.id) ? 'ring-2 ring-sky-300/70' : ''"
                @contextmenu.prevent.stop="catalogPreviewCard = card"
                @mouseenter="updateCatalogTooltip(card, $event)"
                @mousemove="updateCatalogTooltip(card, $event)"
                @mouseleave="clearCatalogTooltip(card)"
              >
                <button
                  type="button"
                  class="block w-full cursor-pointer text-left disabled:cursor-not-allowed"
                  :disabled="!activeCanEditDeckSelection && !canHighlightActiveCards"
                  :aria-label="`Draft ${card.title}`"
                  @click="selectDraftCard(card)"
                >
                  <div class="relative aspect-63/88 overflow-hidden bg-transparent">
                    <img
                      v-if="card.imageUrl"
                      :src="card.imageUrl"
                      :alt="card.title"
                      class="h-full w-full object-cover"
                    />
                    <div
                      v-else
                      class="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,#f7e6c0_0%,#ddc48f_35%,#7b5f31_100%)] p-3 text-center text-sm font-semibold text-amber-950"
                    >
                      {{ card.title }}
                    </div>
                  </div>

                  <div class="p-3">
                    <p class="truncate font-semibold">{{ card.title }}</p>
                    <p v-if="getCardTags(card)" class="mt-1 text-xs text-white/50">{{ getCardTags(card) }}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div v-else class="mt-8 max-h-[clamp(34rem,58vw,56rem)] overflow-y-auto pr-2">
            <div class="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-4">
              <div
                v-for="(card, cardIndex) in filteredCatalogCards"
                :key="`catalog-${card.id}-${cardIndex}`"
                class="relative overflow-hidden rounded-[1.4rem] border bg-white/5 transition"
                :class="[
                  selectedCatalogCounts[card.id]
                    ? 'border-amber-300/50 bg-amber-300/10'
                    : 'border-white/10 hover:border-white/25 hover:bg-white/10',
                  highlightedCatalogCardIds.has(card.id) ? 'ring-2 ring-sky-300/70' : '',
                ]"
                :aria-disabled="!activeCanEditDeckSelection && !canHighlightActiveCards"
                @contextmenu.prevent.stop="catalogPreviewCard = card"
                @mouseenter="updateCatalogTooltip(card, $event)"
                @mousemove="updateCatalogTooltip(card, $event)"
                @mouseleave="clearCatalogTooltip(card)"
              >
                <button
                  type="button"
                  class="block w-full cursor-pointer text-left disabled:cursor-not-allowed"
                  :disabled="!activeCanEditDeckSelection && !canHighlightActiveCards"
                  :aria-label="
                    canHighlightActiveCards
                      ? `Highlight ${card.title}`
                      : activeCanEditDeckSelection
                        ? `Add ${card.title}`
                        : 'Unready to change your selection'
                  "
                  @click="handleCatalogCardClick(card)"
                >
                  <div class="relative aspect-63/88 overflow-hidden bg-transparent">
                    <img
                      v-if="card.imageUrl"
                      :src="card.imageUrl"
                      :alt="card.title"
                      class="h-full w-full object-cover"
                    />
                    <div
                      v-else
                      class="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,#f7e6c0_0%,#ddc48f_35%,#7b5f31_100%)] p-3 text-center text-sm font-semibold text-amber-950"
                    >
                      {{ card.title }}
                    </div>
                  </div>

                  <div class="p-3">
                    <div class="min-w-0">
                      <p class="truncate font-semibold">{{ card.title }}</p>
                      <p v-if="getCardTags(card)" class="mt-1 text-xs text-white/50">{{ getCardTags(card) }}</p>
                    </div>
                  </div>
                </button>

                <button
                  v-if="selectedCatalogCounts[card.id] && activeCanEditDeckSelection"
                  type="button"
                  class="absolute top-2 right-2 cursor-pointer rounded-full bg-amber-300 px-2.5 py-1 text-[0.7rem] font-semibold text-amber-950 shadow-lg transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="!activeCanEditDeckSelection"
                  :aria-label="`Remove one ${card.title}`"
                  @click.stop="removeCardSelection(card.id)"
                >
                  Selected x{{ selectedCatalogCounts[card.id] }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </section>

      <CrawlV3DeckSelectionSidebar
        v-if="!isSpectator || isMirroringPlayerLobby"
        :rows="selectedCatalogRows"
        :category-rows="selectedCategoryRows"
        :total="activeSelectionIds.length"
        :title="isMirroringPlayerLobby ? `${activePlayerName}'s Deck` : 'Your Deck'"
        :can-edit="activeCanEditDeckSelection"
        :can-highlight="canHighlightActiveCards"
        :highlighted-card-ids="highlightedCatalogCardIds"
        @clear="clearCatalogSelection"
        @remove="removeCardSelection"
        @highlight="handleSelectedCardRowClick"
        @preview="catalogPreviewCard = $event"
        @tooltip="updateCatalogTooltip"
        @tooltip-clear="clearCatalogTooltip"
      />
    </div>

    <CrawlV3CatalogTooltip :card="catalogTooltipCard" :point="catalogTooltipPoint" />

    <CrawlV3CardPreviewModal
      v-if="catalogPreviewState"
      :card="catalogPreviewState"
      :show-face="true"
      @close="catalogPreviewCard = null"
    />
  </div>
</template>
