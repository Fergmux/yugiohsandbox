<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { storeToRefs } from 'pinia'

import InspectModal from '@/components/InspectModal.vue'
import { useCrawlManager } from '@/composables/crawler/crawlManager'
import { usePageManager } from '@/composables/crawler/pageManager'
import { useCrawlStore } from '@/stores/crawl'
import { useDeckStore } from '@/stores/deck'
import { extraDeckTypes } from '@/types/filters'
import type { YugiohCard } from '@/types/yugiohCard'
import { getS3ImageUrl } from '@/utils'

const { next } = usePageManager()
const { crawl, player } = useCrawlManager()
const deckStore = useDeckStore()
const { allCards } = storeToRefs(deckStore)
const { getDecks, getAllCards } = deckStore
const crawlStore = useCrawlStore()
const { getAdminDecks } = crawlStore
const { starterDecks } = storeToRefs(crawlStore)

const deckCards = computed(() =>
  allCards.value
    .filter((card) => selectedDeck.value?.cards.includes(card.id))
    .filter((card) => !extraDeckTypes.includes(card.type) && card.type !== 'Token'),
)
const selectedCard = ref<YugiohCard | null>(null)
const selectedDeckId = ref<string | undefined>(undefined)

onMounted(async () => {
  await getAdminDecks()
  await getDecks()
  await getAllCards()
})

const selectedDeck = computed(() => starterDecks.value.find((deck) => deck.id === selectedDeckId.value))

const confirm = async () => {
  if (selectedDeckId.value && player.value) {
    await fetch('/.netlify/functions/update-crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...crawl.value,
        [player.value]: { ...crawl.value[player.value], deck: selectedDeck.value?.cards ?? [] },
      }),
    })
    next()
  }
}
</script>

<template>
  <div>
    <div class="mx-auto flex w-max flex-wrap gap-2">
      <div
        v-for="deck in starterDecks"
        :key="deck.id"
        class="cursor-pointer rounded-md border-1 border-gray-200 p-2"
        @click="selectedDeckId = deck.id"
      >
        <h3>{{ deck.name.split('ST-')[1] }}</h3>
      </div>
    </div>
    <button
      v-if="selectedDeckId"
      @click="confirm"
      class="m-auto my-4 block cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
    >
      Confirm
    </button>
    <ul
      v-if="selectedDeck"
      class="mx-4 grid grid-cols-[repeat(auto-fill,minmax(80px,120px))] justify-around gap-4 sm:grid-cols-[repeat(auto-fill,minmax(100px,150px))]"
    >
      <li
        v-for="(card, index) in deckCards"
        :key="`${card.id}+${index}`"
        class="relative flex justify-center transition-transform duration-100"
      >
        <img
          @dragstart.prevent=""
          @click.right.prevent="selectedCard = card"
          :src="getS3ImageUrl(card.id)"
          :alt="card.name"
          class="w-full max-w-[300px] min-w-[80px] rounded-sm shadow-md"
        />
      </li>
    </ul>
    <inspect-modal v-if="selectedCard" :cards="[selectedCard]" @close="selectedCard = null" />
  </div>
</template>
