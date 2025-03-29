<script setup lang="ts">
import type { ComputedRef, Ref } from 'vue'
import { computed, onMounted, ref, watch } from 'vue'

import { debounce } from 'lodash'
import { storeToRefs } from 'pinia'

import DeckSection from '@/components/DeckSection.vue'
import DeckSelect from '@/components/DeckSelect.vue'
import SearchFilters from '@/components/filters/SearchFilters.vue'
import InspectModal from '@/components/InspectModal.vue'
import { useDeckStore } from '@/stores/deck'
import { extraDeckTypes, frameTypeOptions } from '@/types/filters'
import type { YugiohCard } from '@/types/yugiohCard'

const deckStore = useDeckStore()
const { decks, allCards, addingDeck } = storeToRefs(deckStore)
const { getAllCards, addDeck, addCardToDeck, removeCardFromDeck, changeDeckName } = deckStore

// Fetch all Yu-Gi-Oh! cards and decks on component mount
onMounted(async () => {
  getAllCards()
})

const deckName = ref('')
const searchLimit = ref(30)

// SELECT DECK //

const selectedDeckId = ref<string | undefined>()
const selectedDeck = computed(() => decks.value.find((deck) => deck.id === selectedDeckId.value))
const setSelectedDeckId = (deckId: string) => (selectedDeckId.value = deckId)
const addDeckAndSelect = async () => {
  const deckId = await addDeck(deckName.value)
  deckName.value = ''
  setSelectedDeckId(deckId)
}

const currentDeckName = ref('')

// Update currentDeckName when selectedDeck changes
watch(selectedDeck, (newDeck) => {
  if (newDeck) {
    currentDeckName.value = newDeck.name
  }
})

// Watch for changes to currentDeckName and update the deck with debounce
watch(
  currentDeckName,
  debounce((newName: string) => {
    if (selectedDeckId.value && selectedDeck.value) {
      changeDeckName(selectedDeckId.value, newName)
    }
  }, 500),
)

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
  addCardToDeck(selectedDeckId.value, cardId)
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
      <deck-select v-model="selectedDeckId" allow-delete />
      <div class="flex basis-1/5 flex-col rounded-md border-1 border-gray-300 p-4">
        <h3 class="text-2xl font-semibold">Add Deck</h3>
        <div class="flex items-center">
          <input
            type="text"
            v-model="deckName"
            placeholder="Deck name"
            class="basis-full rounded-md border-1 border-gray-300 p-2"
            @keyup.enter="addDeckAndSelect"
          />
          <button
            @click="addDeckAndSelect"
            class="m-2 flex cursor-pointer items-center rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
            :disabled="addingDeck || !deckName"
            :class="{ 'cursor-default! opacity-50': addingDeck || !deckName }"
          >
            <span v-if="addingDeck" class="material-symbols-outlined animate-spin"> refresh </span>
            <span v-else class="material-symbols-outlined"> add </span>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="selectedDeck && selectedDeckId"
      class="mt-4 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start"
    >
      <div class="basis-4/5 rounded-md border-1 border-gray-300 p-4">
        <input v-model="currentDeckName" class="text-3xl font-semibold" />
        <deck-section
          :cards="cardsInNormalDeck"
          :max="60"
          @select="selectCard"
          @remove="removeCardFromDeck(selectedDeckId, $event)"
        >
          Main Deck
        </deck-section>
        <deck-section
          :cards="cardsInExtraDeck"
          :max="15"
          @select="selectCard"
          @remove="removeCardFromDeck(selectedDeckId, $event)"
        >
          Extra Deck
        </deck-section>
        <deck-section :cards="tokenCards" @select="selectCard" @remove="removeCardFromDeck(selectedDeckId, $event)">
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
              <div>
                <img :src="getS3ImageUrl(card.id)" :alt="card.name" class="w-32" />
                <p>{{ card.name }}</p>
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
