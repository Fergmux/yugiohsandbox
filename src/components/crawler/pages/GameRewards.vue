<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { storeToRefs } from 'pinia'

import InspectModal from '@/components/InspectModal.vue'
import { useCrawlManager } from '@/composables/crawler/crawlManager'
import { usePageManager } from '@/composables/crawler/pageManager'
import { useCrawlStore } from '@/stores/crawl'
import { useDeckStore } from '@/stores/deck'
import type { Power } from '@/types/crawl'
import type { Deck } from '@/types/deck'
import type { YugiohCard } from '@/types/yugiohCard'
import { getS3ImageUrl } from '@/utils'

const { next } = usePageManager()
const { powers, deck, removeCardFromDeck, addPowerToUser, removePowerFromUser, addCardToDeck } = useCrawlManager()
const { allCards } = storeToRefs(useDeckStore())
const crawlStore = useCrawlStore()
const { getPowers, getAdminDecks } = crawlStore
const { rewardDecks, powerRewards } = storeToRefs(crawlStore)

const deckCards = computed(() => allCards.value.filter((card) => deck.value.includes(card.id)))
const selectedCard = ref<YugiohCard | null>(null)

const selectedReward = ref<string | null>(null)
const selectedRewardDeck = ref<Deck | null>(null)

onMounted(async () => {
  await getPowers()
  await getAdminDecks()
})

const newPower = ref<Power | null>(null)
const pickRandomPower = () => {
  const index = Math.floor(Math.random() * powerRewards.value.length)
  return powerRewards.value[index]
}

const acceptPower = async (power: Power) => {
  await addPowerToUser(power)
  selectedReward.value = null
  newPower.value = null
}

const rerolledPower = ref<Power | null>(null)
const rerollPower = async (id: string) => {
  await removePowerFromUser(id)
  rerolledPower.value = pickRandomPower()
}
const acceptRerolledPower = async (power: Power) => {
  await addPowerToUser(power)
  rerolledPower.value = null
  selectedReward.value = null
}

const selectRewardDeck = (deck: Deck) => {
  selectedRewardDeck.value = deck
  pickRandomCards()
}
const previewDeckId = ref<string | null>(null)
const previewDeckCards = computed(() => {
  const deck = rewardDecks.value.find((d) => d.id === previewDeckId.value)
  return allCards.value.filter((card) => deck?.cards.includes(card.id))
})

const cardOptions = ref<YugiohCard[]>([])
const pickRandomCards = async () => {
  cardOptions.value = allCards.value
    .filter((card) => selectedRewardDeck.value?.cards.includes(card.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
}

const pickCard = async (id: number) => {
  await addCardToDeck(id)
  selectedReward.value = null
  selectedRewardDeck.value = null
}

const removeCard = async (id: number) => {
  await removeCardFromDeck(id)
  selectedReward.value = null
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold">Rewards</h1>
      <p class="mt-1 text-sm text-gray-500">Choose your rewards</p>
    </div>

    <!-- Reward selection -->
    <div v-if="!selectedReward" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <button
        @click="selectedReward = 'card'"
        class="flex cursor-pointer flex-col items-center gap-2 rounded-md border-1 border-gray-300 p-4 transition-colors active:bg-gray-200"
      >
        <span class="material-symbols-outlined text-3xl">style</span>
        <span class="text-sm font-medium">Pick a Card</span>
      </button>
      <button
        @click="selectedReward = 'power'"
        class="flex cursor-pointer flex-col items-center gap-2 rounded-md border-1 border-gray-300 p-4 transition-colors active:bg-gray-200"
      >
        <span class="material-symbols-outlined text-3xl">auto_awesome</span>
        <span class="text-sm font-medium">Gain a Power</span>
      </button>
      <button
        @click="selectedReward = 'reroll'"
        class="flex cursor-pointer flex-col items-center gap-2 rounded-md border-1 border-gray-300 p-4 transition-colors active:bg-gray-200"
      >
        <span class="material-symbols-outlined text-3xl">casino</span>
        <span class="text-sm font-medium">Reroll a Power</span>
      </button>
      <button
        @click="selectedReward = 'remove'"
        class="flex cursor-pointer flex-col items-center gap-2 rounded-md border-1 border-gray-300 p-4 transition-colors active:bg-gray-200"
      >
        <span class="material-symbols-outlined text-3xl">delete</span>
        <span class="text-sm font-medium">Remove a Card</span>
      </button>
    </div>

    <!-- Pick a card -->
    <div v-if="selectedReward === 'card'" class="flex flex-col gap-4">
      <div>
        <button
          @click="selectedReward = null"
          class="mr-2 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border-1 border-gray-300 active:bg-gray-600"
        >
          <span class="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <h2 class="inline text-lg font-semibold">Pick a Card</h2>
      </div>

      <div v-if="!selectedRewardDeck" class="flex flex-col gap-2">
        <p class="text-sm text-gray-500">Select a deck to draw from</p>
        <div class="flex flex-col gap-2">
          <div v-for="deck in rewardDecks" :key="deck.id" class="rounded-md border-1 border-gray-300">
            <div class="flex items-center justify-between p-3">
              <div>
                <span class="font-medium">{{ deck.name }}</span>
                <span class="mt-0.5 block text-xs text-gray-500">{{ deck.cards?.length ?? 0 }} cards</span>
              </div>
              <div class="flex gap-2">
                <button
                  @click="previewDeckId = previewDeckId === deck.id ? null : deck.id"
                  class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1 text-sm transition-colors active:bg-gray-200"
                >
                  {{ previewDeckId === deck.id ? 'Hide cards' : 'View cards' }}
                </button>
                <button
                  @click="selectRewardDeck(deck)"
                  class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1 text-sm transition-colors active:bg-gray-200"
                >
                  Select
                </button>
              </div>
            </div>
            <div v-if="previewDeckId === deck.id" class="border-t-1 border-gray-200 p-3">
              <ul class="grid grid-cols-[repeat(auto-fill,minmax(60px,80px))] gap-2">
                <li
                  v-for="(card, index) in previewDeckCards"
                  :key="`${card.id}+${index}`"
                  class="flex cursor-pointer justify-center transition-transform duration-100 hover:scale-105"
                >
                  <img
                    @dragstart.prevent=""
                    @click.right.prevent="selectedCard = card"
                    :src="getS3ImageUrl(card.id)"
                    :alt="card.name"
                    class="w-full rounded-sm shadow-sm"
                  />
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col gap-3">
        <p class="text-sm text-gray-400">
          Drawing from <span class="font-semibold text-gray-300">{{ selectedRewardDeck.name }}</span>
        </p>
        <ul class="flex flex-wrap justify-around gap-4">
          <li
            v-for="(card, index) in cardOptions"
            :key="`${card.id}+${index}`"
            class="relative flex cursor-pointer justify-center transition-transform duration-100 hover:scale-105"
          >
            <img
              @dragstart.prevent=""
              @click.right.prevent="selectedCard = card"
              @click="pickCard(card.id)"
              :src="getS3ImageUrl(card.id)"
              :alt="card.name"
              class="w-[150px] rounded-sm shadow-md sm:w-[180px]"
            />
          </li>
        </ul>
      </div>
    </div>

    <!-- Gain a power -->
    <div v-if="selectedReward === 'power'" class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <button
          v-if="!newPower"
          @click="
            selectedReward = null
            newPower = null
          "
          class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border-1 border-gray-300 active:bg-gray-600"
        >
          <span class="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <h2 class="text-lg font-semibold">Gain a Power</h2>
      </div>

      <div v-if="!newPower" class="flex flex-col items-center gap-3 py-6">
        <p class="text-sm text-gray-500">Roll to discover your new power</p>
        <button
          @click="newPower = pickRandomPower()"
          class="cursor-pointer rounded-md border-1 border-gray-300 px-6 py-3 font-medium transition-colors active:bg-gray-200"
        >
          Roll for Power
        </button>
      </div>

      <div v-else class="flex flex-col gap-3">
        <div class="rounded-md border-1 border-gray-300 p-4">
          <p class="font-semibold">{{ newPower.name }}</p>
          <p class="mt-1 text-sm text-gray-500">{{ newPower.description }}</p>
        </div>
        <div class="flex gap-2">
          <button
            @click="acceptPower(newPower)"
            class="cursor-pointer rounded-md border-1 border-gray-300 px-4 py-2 font-medium transition-colors active:bg-gray-200"
          >
            Accept Power
          </button>
          <!-- <button
            @click="pickRandomPower"
            class="cursor-pointer rounded-md border-1 border-gray-300 px-4 py-2 text-sm transition-colors active:bg-gray-200"
          >
            Reroll
          </button> -->
        </div>
      </div>
    </div>

    <!-- Reroll a power -->
    <div v-if="selectedReward === 'reroll'" class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <button
          v-if="!rerolledPower"
          @click="
            selectedReward = null
            rerolledPower = null
          "
          class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border-1 border-gray-300 active:bg-gray-600"
        >
          <span class="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <h2 class="text-lg font-semibold">Reroll a Power</h2>
      </div>

      <div v-if="!rerolledPower" class="flex flex-col gap-2">
        <p class="text-sm text-gray-500">Select a power to reroll</p>
        <div class="flex flex-col gap-2">
          <button
            v-for="power in powers"
            :key="power.name"
            @click="rerollPower(power.id)"
            class="cursor-pointer rounded-md border-1 border-gray-300 p-3 text-left transition-colors active:bg-gray-200"
          >
            <p class="font-medium">{{ power.name }}</p>
            <p class="mt-0.5 text-sm text-gray-500">{{ power.description }}</p>
          </button>
        </div>
      </div>

      <div v-else class="flex flex-col gap-3">
        <p class="text-sm text-gray-500">Your new power:</p>
        <div class="rounded-md border-1 border-gray-300 p-4">
          <p class="font-semibold">{{ rerolledPower.name }}</p>
          <p class="mt-1 text-sm text-gray-500">{{ rerolledPower.description }}</p>
        </div>
        <button
          @click="acceptRerolledPower(rerolledPower)"
          class="cursor-pointer self-start rounded-md border-1 border-gray-300 px-4 py-2 font-medium transition-colors active:bg-gray-200"
        >
          Accept Power
        </button>
      </div>
    </div>

    <!-- Remove a card -->
    <div v-if="selectedReward === 'remove'" class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <button
          @click="selectedReward = null"
          class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border-1 border-gray-300 active:bg-gray-600"
        >
          <span class="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <h2 class="text-lg font-semibold">Remove a Card</h2>
      </div>
      <p class="text-sm text-gray-500">Click a card to remove it from your deck</p>
      <ul
        class="grid grid-cols-[repeat(auto-fill,minmax(80px,120px))] justify-around gap-4 sm:grid-cols-[repeat(auto-fill,minmax(100px,150px))]"
      >
        <li
          v-for="(card, index) in deckCards"
          :key="`${card.id}+${index}`"
          class="relative flex cursor-pointer justify-center transition-transform duration-100 hover:scale-105"
        >
          <img
            @dragstart.prevent=""
            @click.right.prevent="selectedCard = card"
            @click="removeCard(card.id)"
            :src="getS3ImageUrl(card.id)"
            :alt="card.name"
            class="w-full max-w-[300px] min-w-[80px] rounded-sm shadow-md"
          />
        </li>
      </ul>
    </div>

    <div class="border-t-1 border-gray-200 pt-4">
      <button
        @click="next"
        class="float-right cursor-pointer rounded-md border-1 border-gray-300 px-6 py-2 transition-colors active:bg-gray-200"
      >
        Finished
      </button>
    </div>

    <inspect-modal v-if="selectedCard" :cards="[selectedCard]" @close="selectedCard = null" />
  </div>
</template>
