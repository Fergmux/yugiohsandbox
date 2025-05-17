<script setup lang="ts">
import { onMounted } from 'vue'

import { storeToRefs } from 'pinia'

import { useDeckStore } from '@/stores/deck'

const deckStore = useDeckStore()
const { decks, decksLoading } = storeToRefs(deckStore)
const { ensureDecks } = deckStore

onMounted(async () => {
  await ensureDecks()
})

const selectedDeckId = defineModel<string>()
</script>
<template>
  <div class="flex flex-col items-start rounded-md border-1 border-gray-300 p-4">
    <h3 class="text-2xl font-semibold">Decks</h3>
    <div v-if="decksLoading && !decks.length" class="material-symbols-outlined mx-auto mt-2 animate-spin">refresh</div>
    <div class="mt-2 flex max-w-full flex-wrap gap-2" v-else-if="decks.length">
      <button
        v-for="deck in decks"
        :key="deck.id"
        class="flex cursor-pointer items-center justify-between rounded-md border-1 border-gray-300 p-2 active:bg-gray-400"
        :class="{ 'bg-neutral-400 font-semibold text-gray-900': selectedDeckId === deck.id }"
        @click="selectedDeckId = deck.id"
      >
        <h4 class="overflow-hidden text-xl overflow-ellipsis">
          {{ deck.name }}
        </h4>
      </button>
    </div>
    <p v-else>No decks yet</p>
  </div>
</template>
