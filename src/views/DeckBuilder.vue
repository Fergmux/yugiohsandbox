<script setup lang="ts">
import InspectModal from '@/components/InspectModal.vue'
import { useDeckStore } from '@/stores/deck'
import type { YugiohCard } from '@/types'
import { ArrowPathIcon, PlusCircleIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { storeToRefs } from 'pinia'
import type { ComputedRef } from 'vue'
import { computed, onMounted, ref, watch } from 'vue'

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
const searchLimit = ref(30)

// SELECT DECK //

const selectedDeckId = ref<string | null>(null)
const selectedDeck = computed(() => decks.value.find((deck) => deck.id === selectedDeckId.value))
const setSelectedDeckId = (deckId: string) => (selectedDeckId.value = deckId)
const addDeckAndSelect = async (name: string) => {
  const deckId = await addDeck(name)
  deckName.value = ''
  setSelectedDeckId(deckId)
}

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
        .filter(Boolean) as YugiohCard[] | undefined,
  ) ?? []

const cardsInNormalDeck = computed(() =>
  cardsInDeck.value
    ?.filter((card) => !extraDeckTypes.includes(card.type) && card.type !== 'Token')
    .sort((a, b) => a.name.localeCompare(b.name)),
)
const cardsInExtraDeck = computed(() =>
  cardsInDeck.value
    ?.filter((card) => extraDeckTypes.includes(card.type))
    .sort((a, b) => a.name.localeCompare(b.name)),
)

const tokenCards = computed(() =>
  cardsInDeck.value
    ?.filter((card) => card.type === 'Token')
    .sort((a, b) => a.name.localeCompare(b.name)),
)

// SELECT CARD //

const selectedCard = ref<YugiohCard | null>(null)
const selectCard = (card: YugiohCard | null) => {
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
    .slice(0, searchLimit.value),
) // Limit suggestions to 10

// const searchedCard: ComputedRef<YugiohCard | undefined> = computed(() => {
//   return allCards.value.find((card) => card.name.toLowerCase() === searchQuery.value.toLowerCase())
// })

watch(searchQuery, () => {
  searchLimit.value = 30
})
</script>

<template>
  <div class="p-8">
    <div class="flex items-end justify-between">
      <div class="flex flex-col items-start rounded-md border-1 border-gray-300 p-4">
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
            class="m-2 flex cursor-pointer items-center rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
            :disabled="addingDeck || !deckName"
            :class="{ 'cursor-default! opacity-50': addingDeck || !deckName }"
          >
            <ArrowPathIcon v-if="addingDeck" class="size-6 animate-spin" />
            <PlusCircleIcon v-else class="size-6" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="selectedDeck && selectedDeckId" class="mt-4 flex items-start justify-between">
      <div class="mr-4 basis-4/5 rounded-md border-1 border-gray-300 p-4">
        <h2 class="text-3xl font-semibold">
          {{ selectedDeck.name }}
        </h2>
        <div class="mt-4">
          <h3 class="text-2xl font-semibold">
            Normal deck <span class="font-normal"> - {{ cardsInNormalDeck?.length }}/60</span>
          </h3>
          <div class="mt-2">
            <ul
              class="grid-cols-auto grid grid-cols-[repeat(auto-fill,minmax(100px,150px))] gap-2 lg:grid-cols-[repeat(auto-fill,minmax(100px,200px))] 2xl:grid-cols-[repeat(auto-fill,minmax(100px,250px))]"
            >
              <li
                v-for="(card, index) in cardsInNormalDeck"
                v-memo="[card.id]"
                :key="`${card.id}${index}`"
                class="flex justify-center"
              >
                <img
                  @dragstart.prevent=""
                  @click.right.prevent="selectCard(card)"
                  @click="removeCardFromDeck(selectedDeckId, card.id)"
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
            Extra deck <span class="font-normal"> - {{ cardsInExtraDeck?.length }}/15</span>
          </h3>
          <div class="mt-2">
            <ul
              class="grid-cols-auto grid grid-cols-[repeat(auto-fill,minmax(100px,150px))] gap-2 lg:grid-cols-[repeat(auto-fill,minmax(100px,200px))] 2xl:grid-cols-[repeat(auto-fill,minmax(100px,250px))]"
            >
              <li
                v-for="(card, index) in cardsInExtraDeck"
                :key="`${card.id}${index}`"
                v-memo="[card.id]"
              >
                <img
                  @dragstart.prevent=""
                  @click.right.prevent="selectCard(card)"
                  @click="removeCardFromDeck(selectedDeckId, card.id)"
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
            Tokens <span class="font-normal"> - {{ tokenCards?.length }}</span>
          </h3>
          <div class="mt-2">
            <ul
              class="grid-cols-auto grid grid-cols-[repeat(auto-fill,minmax(100px,150px))] gap-2 lg:grid-cols-[repeat(auto-fill,minmax(100px,200px))] 2xl:grid-cols-[repeat(auto-fill,minmax(100px,250px))]"
            >
              <li
                v-for="(card, index) in tokenCards"
                :key="`${card.id}${index}`"
                v-memo="[card.id]"
              >
                <img
                  @dragstart.prevent=""
                  @click.right.prevent="selectCard(card)"
                  @click="removeCardFromDeck(selectedDeckId, card.id)"
                  :src="getS3ImageUrl(card.id)"
                  :alt="card.name"
                  class="w-full max-w-[300px] min-w-[100px]"
                />
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="sticky top-2 min-w-80 basis-1/5 text-center">
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Search for a card..."
          class="mb-4 w-full rounded-md border-1 border-gray-300 p-2"
        />

        <!-- Autocomplete Suggestions -->
        <ul
          v-if="searchFilteredCards.length"
          class="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2"
        >
          <li
            v-for="card in searchFilteredCards"
            :key="card.id"
            @dragstart.prevent=""
            @click="addCardToDeck(selectedDeckId, card.id)"
            @click.right.prevent="selectCard(card)"
          >
            <img :src="getS3ImageUrl(card.id)" :alt="card.name" class="w-32" />
            <p>{{ card.name }}</p>
          </li>
        </ul>
        <button
          v-if="searchFilteredCards.length > 0 && searchFilteredCards.length % 30 === 0"
          class="mt-4 cursor-pointer rounded-md border-1 border-gray-300 p-2"
          @click="searchLimit += 30"
        >
          Load more
        </button>
      </div>
    </div>
    <inspect-modal v-if="selectedCard" :card-list="[selectedCard]" @close="selectCard(null)" />
  </div>
</template>
