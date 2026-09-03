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
import type { Crawlv3CatalogCard } from '@/types/crawlv3'
import type { Crawlv3SpectatorPerspective } from '@/types/crawlv3-ui'

const {
  game,
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

const spectatorPerspectiveOptions = computed<{ value: Crawlv3SpectatorPerspective; label: string }[]>(() => [
  { value: 'both', label: 'Both' },
  { value: 'player1', label: game.value?.players.player1?.username ?? 'Player 1' },
  { value: 'player2', label: game.value?.players.player2?.username ?? 'Player 2' },
])

const canPreviewCatalogDraft = computed(() => {
  const config = configDraft.value
  return !!safeTrim(config?.csvUrl) && !!safeTrim(config?.headers?.id) && !!safeTrim(config?.headers?.title)
})

const selectedCatalogCounts = computed(() =>
  localSelectionIds.value.reduce<Record<string, number>>((counts, cardId) => {
    counts[cardId] = (counts[cardId] ?? 0) + 1
    return counts
  }, {}),
)

const selectedCatalogRows = computed(() => {
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
  categoryFilterOptions.value.map((category) => ({
    category,
    count: catalogCards.value.reduce((total, card) => {
      if (!splitCatalogValues(card.category).includes(category)) return total
      return total + (selectedCatalogCounts.value[card.id] ?? 0)
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

const catalogPreviewState = computed(() => {
  const card = catalogPreviewCard.value
  if (!card) return null

  return createCatalogPreviewCardState(card, myPlayer.value ?? 'player1')
})

const canReadyUp = computed(() => canEditDeckSelection.value && !!localSelectionIds.value.length)

function resetDraftCardsState() {
  draftMode.value = 'catalog'
  draftCategory.value = ''
  draftChoices.value = []
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

function clearCatalogSearch() {
  catalogSearch.value = ''
}

function startDraftCards() {
  if (!canEditDeckSelection.value || !catalogCards.value.length) return
  draftMode.value = 'categories'
  draftCategory.value = ''
  draftChoices.value = []
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
  draftCategory.value = category
  draftChoices.value = choices
  draftMode.value = 'choices'
  clearCatalogTooltip()
}

function returnToDraftCategories() {
  draftCategory.value = ''
  draftChoices.value = []
  draftMode.value = 'categories'
  clearCatalogTooltip()
}

function selectDraftCard(card: Crawlv3CatalogCard) {
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
        :class="isSpectator ? 'xl:col-span-2' : ''"
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
            <p v-else class="mt-2 text-white/60">
              Choose the player perspective you want for the game. Both players' selected cards stay visible here.
            </p>
          </div>
          <div v-if="!isSpectator" class="flex flex-wrap gap-3">
            <button
              v-if="draftMode === 'catalog'"
              type="button"
              class="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canEditDeckSelection || !catalogCards.length"
              @click="startDraftCards"
            >
              Draft Cards
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canEditDeckSelection"
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
        </div>

        <template v-if="isSpectator">
          <CrawlV3SpectatorDeckSelections
            v-model:perspective="spectatorPerspective"
            :game="game"
            :perspective-options="spectatorPerspectiveOptions"
            :player-selection-rows="playerSelectionRows"
            @preview="catalogPreviewCard = $event"
          />
        </template>
        <template v-else>
          <div v-if="draftMode === 'catalog'" class="mt-6 flex flex-wrap items-center gap-3">
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

          <div v-if="draftMode === 'catalog'" class="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
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

          <div v-else-if="draftMode === 'categories'" class="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="text-xs font-semibold tracking-[0.35em] text-amber-200/70 uppercase">Draft Cards</p>
                <h3 class="mt-2 text-2xl font-semibold">Choose a Category</h3>
                <p class="mt-2 text-sm text-white/60">
                  Pick a category to see three random cards from it. Selecting a card adds it to your deck.
                </p>
              </div>
              <button
                type="button"
                class="cursor-pointer rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-200"
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
                :disabled="!canEditDeckSelection"
                @click="chooseDraftCategory(category)"
              >
                <span class="block text-lg font-semibold text-white">{{ category }}</span>
                <span class="mt-1 block text-sm text-white/55">{{ count }} cards</span>
              </button>
            </div>
          </div>

          <div v-else-if="draftMode === 'choices'" class="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="text-xs font-semibold tracking-[0.35em] text-amber-200/70 uppercase">
                  {{ draftCategory }}
                </p>
                <h3 class="mt-2 text-2xl font-semibold">Pick One Card</h3>
                <p class="mt-2 text-sm text-white/60">Choose one of these random cards, or skip this draft pick.</p>
              </div>
              <button
                type="button"
                class="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
                @click="returnToDraftCategories"
              >
                Skip
              </button>
            </div>

            <div class="mt-6 grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-4">
              <div
                v-for="card in draftChoices"
                :key="`draft-choice-${card.id}`"
                class="relative overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/20 transition hover:border-amber-300/45 hover:bg-amber-300/10"
                @contextmenu.prevent.stop="catalogPreviewCard = card"
                @mouseenter="updateCatalogTooltip(card, $event)"
                @mousemove="updateCatalogTooltip(card, $event)"
                @mouseleave="clearCatalogTooltip(card)"
              >
                <button
                  type="button"
                  class="block w-full cursor-pointer text-left disabled:cursor-not-allowed"
                  :disabled="!canEditDeckSelection"
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
                :class="
                  selectedCatalogCounts[card.id]
                    ? 'border-amber-300/50 bg-amber-300/10'
                    : 'border-white/10 hover:border-white/25 hover:bg-white/10'
                "
                :aria-disabled="!canEditDeckSelection"
                @contextmenu.prevent.stop="catalogPreviewCard = card"
                @mouseenter="updateCatalogTooltip(card, $event)"
                @mousemove="updateCatalogTooltip(card, $event)"
                @mouseleave="clearCatalogTooltip(card)"
              >
                <button
                  type="button"
                  class="block w-full cursor-pointer text-left disabled:cursor-not-allowed"
                  :disabled="!canEditDeckSelection"
                  :aria-label="canEditDeckSelection ? `Add ${card.title}` : 'Unready to change your selection'"
                  @click="addCardSelection(card.id)"
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
                  v-if="selectedCatalogCounts[card.id]"
                  type="button"
                  class="absolute top-2 right-2 cursor-pointer rounded-full bg-amber-300 px-2.5 py-1 text-[0.7rem] font-semibold text-amber-950 shadow-lg transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="!canEditDeckSelection"
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
        v-if="!isSpectator"
        :rows="selectedCatalogRows"
        :category-rows="selectedCategoryRows"
        :total="localSelectionIds.length"
        :can-edit="canEditDeckSelection"
        @clear="clearCatalogSelection"
        @remove="removeCardSelection"
        @preview="catalogPreviewCard = $event"
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
