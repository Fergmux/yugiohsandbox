<script setup lang="ts">
import type { ComputedRef, Ref } from 'vue'
import { computed, onMounted, provide, ref, watch } from 'vue'

import { storeToRefs } from 'pinia'

import BanlistIndicator from '@/components/deckbuilder/BanlistIndicator.vue'
import DeckActions from '@/components/deckbuilder/deck-actions/DeckActions.vue'
import DeckSection from '@/components/deckbuilder/DeckSection.vue'
import DeckSelect from '@/components/deckbuilder/DeckSelect.vue'
import SearchFilters from '@/components/filters/SearchFilters.vue'
import InspectModal from '@/components/InspectModal.vue'
import { useDeckStore } from '@/stores/deck'
import { extraDeckTypes, frameTypeOptions } from '@/types/filters'
import type { BanlistFormat, YugiohCard } from '@/types/yugiohCard'

const deckStore = useDeckStore()
const { decks, allCards, selectedDeckId } = storeToRefs(deckStore)
const { getAllCards, addCardToDeck, removeCardFromDeck } = deckStore

// Fetch all Yu-Gi-Oh! cards and decks on component mount
onMounted(async () => {
  getAllCards()
})

// DECK FORMAT //
const searchLimit = ref(30)
const format = ref<BanlistFormat>('tcg')
provide('format', format)

// SELECT DECK //
const selectedDeck = computed(() => decks.value.find((deck) => deck.id === selectedDeckId.value))

const cardIdMap = computed(() =>
  allCards.value.reduce((acc, card) => {
    acc.set(card.id, card)
    return acc
  }, new Map<number, YugiohCard>()),
)

const cardsInDeck: ComputedRef<YugiohCard[] | undefined> =
  computed(
    () =>
      selectedDeck.value?.cards
        .map((cardId: number) => cardIdMap.value.get(cardId))
        .sort((a, b) => (a && b ? a.name.localeCompare(b.name) : 0))
        .filter(Boolean) as YugiohCard[] | undefined,
  ) ?? []

// Sort function for cards based on frameType and name
const sortCardsByFrameTypeAndName = (a: YugiohCard, b: YugiohCard) => {
  const frameTypes = frameTypeOptions.map((type) => type.toLowerCase())
  // Get the index of each card's frameType in frameTypeOptions
  const aIndex = frameTypes.indexOf(a.frameType.toLowerCase())
  const bIndex = frameTypes.indexOf(b.frameType.toLowerCase())

  // Sort by frameType order first
  if (aIndex !== bIndex) {
    return aIndex - bIndex
  }

  // Sort by level/rank second (if both cards have a level/rank)
  if (a.level !== undefined && b.level !== undefined) {
    return a.level - b.level
  }

  // Then sort alphabetically by name
  return a.name.localeCompare(b.name)
}

const cardsInNormalDeck = computed(() =>
  cardsInDeck.value
    ?.filter((card) => !extraDeckTypes.includes(card.type) && card.type !== 'Token')
    .sort(sortCardsByFrameTypeAndName),
)

const cardsInExtraDeck = computed(() =>
  cardsInDeck.value?.filter((card) => extraDeckTypes.includes(card.type)).sort(sortCardsByFrameTypeAndName),
)

const tokenCards = computed(() =>
  cardsInDeck.value?.filter((card) => card.type === 'Token').sort(sortCardsByFrameTypeAndName),
)

const getCardCountInDeck = (cardId: number) => {
  return cardsInDeck.value?.filter((card) => card.id === cardId).length
}

// SELECT CARD //

const selectedCard = ref<YugiohCard | null>(null)
const selectCard = (card: YugiohCard | null) => {
  selectedCard.value = card
}

// Construct image URL from S3 bucket using card ID
const getS3ImageUrl = (cardId: number): string => `${import.meta.env.VITE_S3_BUCKET_URL}${cardId}.jpg`

// CARD SEARCH //
const searchQuery = ref('')

const filteredCards: Ref<YugiohCard[]> = ref([])
// Limit suggestions to 30
const searchFilteredCards = computed(() => {
  return [...filteredCards.value]
    .filter(
      (card) =>
        card.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        card.desc.toLowerCase().includes(searchQuery.value.toLowerCase()),
    )
    .sort((a, b) => {
      // Check if name matches search query
      const aNameMatch = a.name.toLowerCase().includes(searchQuery.value.toLowerCase())
      const bNameMatch = b.name.toLowerCase().includes(searchQuery.value.toLowerCase())

      // If one matches name and the other doesn't, prioritize the name match
      if (aNameMatch && !bNameMatch) return -1
      if (!aNameMatch && bNameMatch) return 1

      return 0
    })
})
const limitedSearchResults = computed(() => searchFilteredCards.value.slice(0, searchLimit.value))

const clickingOnCard = ref<number | null>(null)
const clickOnCard = (cardId: number) => {
  if (!selectedDeckId.value) return
  clickingOnCard.value = cardId
  const moveAudio = new Audio('/card_move.mp3')
  moveAudio.play()
  addCardToDeck(cardId)
  setTimeout(() => {
    clickingOnCard.value = null
  }, 100)
}

watch(searchQuery, () => {
  searchLimit.value = 30
})
</script>
<template>
  <div class="p-8">
    <div class="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-end">
      <deck-select v-model="selectedDeckId" />
      <div class="flex gap-4">
        <deck-actions />
      </div>
    </div>

    <div
      v-if="selectedDeck && selectedDeckId"
      class="mt-4 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start"
    >
      <div class="basis-4/5 rounded-md border-1 border-gray-300 p-4">
        <div class="flex items-center justify-between">
          <h1 class="text-3xl font-semibold">{{ selectedDeck.name }}</h1>
          <!-- format select -->
          <div class="mr-4 rounded-md border-1 border-gray-300 p-2">
            <select v-model="format" name="format" id="format" class="outline-none">
              <option value="goat">GOAT</option>
              <option value="ocg">OCG</option>
              <option value="tcg">TCG</option>
            </select>
          </div>
        </div>
        <deck-section :cards="cardsInNormalDeck" :max="60" @select="selectCard" @remove="removeCardFromDeck($event)">
          Main Deck
        </deck-section>
        <deck-section :cards="cardsInExtraDeck" :max="15" @select="selectCard" @remove="removeCardFromDeck($event)">
          Extra Deck
        </deck-section>
        <deck-section :cards="tokenCards" @select="selectCard" @remove="removeCardFromDeck($event)">
          Tokens
        </deck-section>
      </div>

      <div class="mb-[100vh] min-w-80 basis-1/5 text-center">
        <search-filters v-model="filteredCards" />

        <input
          type="text"
          v-model="searchQuery"
          placeholder="Search for a card..."
          class="mb-4 w-full rounded-md border-1 border-gray-300 p-2"
        />

        <!-- Autocomplete Suggestions -->
        <div class="no-scrollbar sticky top-2 h-screen overflow-y-scroll">
          <ul class="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
            <li
              v-for="card in limitedSearchResults"
              :key="card.id"
              @dragstart.prevent=""
              @click="clickOnCard(card.id)"
              @click.right.prevent="selectCard(card)"
              class="cursor-pointer transition-transform duration-75"
              :class="{ 'scale-95': clickingOnCard === card.id }"
            >
              <div>
                <span v-if="!getCardCountInDeck(card.id)" class="text-lg text-white">&#8194;</span>
                <span v-for="i in getCardCountInDeck(card.id)" :key="i" class="text-lg text-white">•</span>
              </div>
              <div class="relative">
                <img :src="getS3ImageUrl(card.id)" :alt="card.name" class="w-32" />
                <p>{{ card.name }}</p>
                <banlist-indicator :banlist-info="card.banlist_info" />
              </div>
            </li>
          </ul>
          <button
            v-if="searchFilteredCards.length > limitedSearchResults.length"
            class="my-4 cursor-pointer rounded-md border-1 border-gray-300 p-2"
            @click="searchLimit += 30"
          >
            Load more
          </button>
        </div>
      </div>
    </div>
    <inspect-modal v-if="selectedCard" :cards="[selectedCard]" @close="selectCard(null)" />
  </div>
</template>
