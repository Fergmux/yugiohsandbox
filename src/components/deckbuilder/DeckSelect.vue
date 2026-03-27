<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { storeToRefs } from 'pinia'

import { useDeckStore } from '@/stores/deck'

const deckStore = useDeckStore()
const { decks, decksLoading } = storeToRefs(deckStore)
const { ensureDecks } = deckStore

const sortedDecks = computed(() => {
  // Type order: starter first, then reward, then others alphabetically
  const typeOrder = ['starter', 'reward']
  return [...decks.value].sort((a, b) => {
    const aIndex = typeOrder.indexOf(a.type ?? '')
    const bIndex = typeOrder.indexOf(b.type ?? '')
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex
    }
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    // Both types are not 'starter' or 'reward' - sort alphabetically by type
    if (a.type !== b.type) {
      return a.type?.localeCompare(b.type ?? '') ?? 0
    }
    // Then by name as tiebreaker (optional)
    return a.name.localeCompare(b.name)
  })
})

onMounted(async () => {
  await ensureDecks()
})

const selectedDeckId = defineModel<string>()
</script>
<template>
  <div class="flex flex-col items-start rounded-md border-1 border-gray-300 p-4">
    <h3 class="text-2xl font-semibold">Decks</h3>
    <div v-if="decksLoading && !decks.length" class="material-symbols-outlined mx-auto mt-4 animate-spin">refresh</div>
    <div class="mt-4 flex max-w-full flex-wrap gap-2" v-else-if="decks.length">
      <button
        v-for="deck in sortedDecks"
        :key="deck.id"
        class="flex cursor-pointer items-center justify-between rounded-md border-1 border-gray-300 p-2 active:bg-gray-400"
        :class="{
          'bg-neutral-400 font-semibold text-gray-900': selectedDeckId === deck.id,
          '!border-yellow-500': deck.type === 'starter',
          '!border-blue-500': deck.type === 'reward',
        }"
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
