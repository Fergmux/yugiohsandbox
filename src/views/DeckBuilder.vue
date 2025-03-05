<script setup lang="ts">
import { useDeckStore } from '@/stores/deck'
import type { YugiohCard } from '@/types'
import { ArrowPathIcon, PlusCircleIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { storeToRefs } from 'pinia'
import type { ComputedRef } from 'vue'
import { computed, onMounted, ref, watchEffect } from 'vue'

const extraDeckTypes = [
  'Fusion Monster',
  'Link Monster',
  'Pendulum Effect Fusion Monster',
  'Synchro Monster',
  'Synchro Pendulum Effect Monster',
  'Synchro Tuner Monster',
  'XYZ Monster',
  'XYZ Pendulum Effect Monster',
]

const deckStore = useDeckStore()
const { decks, allCards, addingDeck, deletingDeck } = storeToRefs(deckStore)
const { getAllCards, getDecks, addDeck, removeDeck, addCardToDeck, removeCardFromDeck } = deckStore

// Fetch all Yu-Gi-Oh! cards and decks on component mount
onMounted(async () => {
  // await Promise.all([getAllCards, getDecks])
  getAllCards()
  getDecks()
})

const deckName = ref('')

// SELECT DECK //

const selectedDeckId = ref<string | null>(null)
const selectedDeck = computed(() => decks.value.find((deck) => deck.id === selectedDeckId.value))
const setSelectedDeckId = (deckId: string) => (selectedDeckId.value = deckId)
const addDeckAndSelect = async (name: string) => {
  const deckId = await addDeck(name)
  deckName.value = ''
  setSelectedDeckId(deckId)
}

const cardsInDeck: ComputedRef<YugiohCard[]> = computed(() => {
  return (
    (selectedDeck.value?.cards
      .map((cardId: number) => allCards.value.find((card) => card.id === cardId))
      .filter(Boolean) as YugiohCard[]) ?? []
  )
})

const cardsInNormalDeck = computed(() =>
  cardsInDeck.value.filter((card) => !extraDeckTypes.includes(card.type)),
)
const cardsInExtraDeck = computed(() =>
  cardsInDeck.value.filter((card) => extraDeckTypes.includes(card.type)),
)

// SELECT CARD //

const selectedCard = ref<YugiohCard | null>(null)
const selectCard = (card: YugiohCard) => {
  selectedCard.value = card
}

// Construct image URL from S3 bucket using card ID
const getS3ImageUrl = (cardId: number): string =>
  `${import.meta.env.VITE_S3_BUCKET_URL}${cardId}.jpg`

// CARD SEARCH //
const searchQuery = ref('')

const searchFilteredCards = computed<YugiohCard[]>(() =>
  allCards.value
    .filter((card) => card.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
    .slice(0, 10),
) // Limit suggestions to 10

const searchedCard: ComputedRef<YugiohCard | undefined> = computed(() => {
  return allCards.value.find((card) => card.name.toLowerCase() === searchQuery.value.toLowerCase())
})
// If the search text matches a card, select it
watchEffect(() => {
  if (searchedCard.value) {
    selectCard(searchedCard.value)
  }
})
</script>

<template>
  <div class="p-8">
    <div class="flex items-end justify-between">
      <div class="flex basis-1/5 flex-col rounded-md border-1 border-gray-300 p-4">
        <h3 class="text-2xl">Add Deck</h3>
        <div class="flex items-center">
          <input
            type="text"
            v-model="deckName"
            placeholder="Deck name"
            class="basis-full rounded-md border-1 border-gray-300 p-2"
          />
          <button
            @click="addDeckAndSelect(deckName)"
            class="m-2 flex cursor-pointer items-center rounded-md border-1 border-gray-300 p-2"
            :disabled="addingDeck || !deckName"
            :class="{ 'cursor-default! opacity-50': addingDeck || !deckName }"
          >
            <ArrowPathIcon v-if="addingDeck" class="size-6 animate-spin" />
            <PlusCircleIcon v-else class="size-6" />
          </button>
        </div>
      </div>
      <div
        class="flex min-w-80 basis-1/5 flex-col items-start rounded-md border-1 border-gray-300 p-4"
      >
        <h3 class="text-2xl">Decks</h3>
        <div class="mt-2 flex max-w-full flex-wrap gap-2" v-if="decks.length">
          <div
            v-for="deck in decks"
            :key="deck.id"
            class="flex max-w-full cursor-pointer items-center rounded-md border-1 border-gray-300 p-2"
          >
            <button class="max-w-full min-w-0 cursor-pointer" @click="setSelectedDeckId(deck.id)">
              <h4 class="overflow-hidden text-xl font-semibold overflow-ellipsis">
                {{ deck.name }}
              </h4>
            </button>
            <button class="ml-2 cursor-pointer" @click="removeDeck(deck.id)">
              <ArrowPathIcon v-if="deletingDeck === deck.id" class="size-6 animate-spin" />
              <TrashIcon v-else class="size-6" />
            </button>
          </div>
        </div>
        <p v-else>No decks yet</p>
      </div>
    </div>

    <div v-if="selectedDeckId" class="mt-4 flex items-start justify-between">
      <div class="mr-4 basis-4/5 rounded-md border-1 border-gray-300 p-4">
        <h2 class="text-3xl font-semibold">
          {{ selectedDeck?.name }}
        </h2>
        <div class="mt-4">
          <h3 class="text-2xl font-semibold">
            Normal deck <span class="font-normal"> - {{ cardsInNormalDeck.length }}/60</span>
          </h3>
          <div class="mt-2">
            <ul
              class="grid-cols-auto grid grid-cols-[repeat(auto-fill,minmax(100px,150px))] gap-2 lg:grid-cols-[repeat(auto-fill,minmax(100px,200px))] 2xl:grid-cols-[repeat(auto-fill,minmax(100px,250px))]"
            >
              <li v-for="card in cardsInNormalDeck" :key="card.id" class="flex justify-center">
                <img
                  @click.prevent="selectCard(card)"
                  @click.right.prevent="removeCardFromDeck(selectedDeckId, card.id)"
                  :src="getS3ImageUrl(card.id)"
                  :alt="card.name"
                  class="w-full max-w-[300px] min-w-[100px]"
                />
              </li>
            </ul>
          </div>
        </div>
        <div class="mt-4">
          <h3 class="text-2xl font-semibold">
            Extra deck <span class="font-normal"> - {{ cardsInExtraDeck.length }}/15</span>
          </h3>
          <div class="mt-2">
            <ul
              class="grid-cols-auto grid grid-cols-[repeat(auto-fill,minmax(100px,150px))] gap-2 lg:grid-cols-[repeat(auto-fill,minmax(100px,200px))] 2xl:grid-cols-[repeat(auto-fill,minmax(100px,250px))]"
            >
              <li v-for="card in cardsInExtraDeck" :key="card.id" class="flex justify-center">
                <img
                  @click.prevent="selectCard(card)"
                  @click.right.prevent="removeCardFromDeck(selectedDeckId, card.id)"
                  :src="getS3ImageUrl(card.id)"
                  :alt="card.name"
                  class="w-full max-w-[300px] min-w-[100px]"
                />
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="sticky top-2 min-w-80 basis-1/5">
        <img
          v-if="selectedCard"
          @click="addCardToDeck(selectedDeckId, selectedCard.id)"
          :src="getS3ImageUrl(selectedCard.id)"
          :alt="selectedCard.name"
          class="mb-4"
        />

        <input
          type="text"
          v-model="searchQuery"
          placeholder="Search for a card..."
          class="w-full rounded-md border-1 border-gray-300 p-2"
        />

        <!-- Autocomplete Suggestions -->
        <ul v-if="searchFilteredCards.length">
          <li
            v-for="card in searchFilteredCards"
            :key="card.id"
            @click="searchQuery = card.name"
            style="cursor: pointer"
          >
            {{ card.name }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
