<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { storeToRefs } from 'pinia'

import DeckSelect from '@/components/deckbuilder/DeckSelect.vue'
import { useCrawlManager } from '@/composables/crawler/crawlManager'
import { usePageManager } from '@/composables/crawler/pageManager'
import { useDeckStore } from '@/stores/deck'

const { next } = usePageManager()
const { crawl, player } = useCrawlManager()
const deckStore = useDeckStore()
const { decks } = storeToRefs(deckStore)
const { getDecks } = deckStore

const selectedDeckId = ref<string | undefined>(undefined)

onMounted(async () => {
  await getDecks()
})

const selectedDeck = computed(() => decks.value.find((deck) => deck.id === selectedDeckId.value))

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
    <deck-select v-model="selectedDeckId" />
    <button
      v-if="selectedDeckId"
      @click="confirm"
      class="m-auto mt-4 block cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
    >
      Confirm
    </button>
  </div>
</template>
