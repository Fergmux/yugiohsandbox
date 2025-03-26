<script setup lang="ts">
import InspectModal from '@/components/InspectModal.vue'
import { useDeckStore } from '@/stores/deck'
import type { YugiohCard } from '@/types'
import { getS3ImageUrl } from '@/utils'
import { useDraggable } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import type { ComputedRef } from 'vue'
import { computed, ref, useTemplateRef } from 'vue'

const deckStore = useDeckStore()
const { decks, allCards } = storeToRefs(deckStore)

const container = useTemplateRef<HTMLElement>('container')

// Fetch all cards and decks on component mount
import { onMounted } from 'vue'

onMounted(async () => {
  await deckStore.getAllCards()
  await deckStore.getDecks()
})

// Deck selection
const selectedDeckId = ref<string | null>(null)

// Get the selected deck
const selectedDeck = computed(() => decks.value.find((deck) => deck.id === selectedDeckId.value))

// Get cards in the deck
const cardsInDeck: ComputedRef<YugiohCard[]> = computed(() => {
  return selectedDeck.value?.cards
    .map((cardId: number) => {
      const card = allCards.value.find((card) => card.id === cardId)
      if (card) {
        return { ...card, uid: uuidv4() }
      }
      return undefined
    })
    .sort((a, b) => (a && b ? a.frameType.localeCompare(b.frameType) : 0))
    .filter(Boolean) as YugiohCard[]
})

// Create refs for each card element
const cardRefs = ref<Map<string, HTMLElement | null>>(new Map())

// Create a map to store the style for each card
const cardStyles = ref<Map<string, string>>(new Map())

const cardZIndexOrder = ref<string[]>([])

// Create a map to store the draggable instances
const draggableInstances = ref<Map<string, ReturnType<typeof useDraggable>>>(new Map())

// Initialize draggable for each card
const initDraggable = (cardId: string, index: number) => {
  const cardRef = cardRefs.value.get(cardId)
  if (!cardRef) return ''

  // If we already have an instance for this card, return its style
  if (draggableInstances.value.has(cardId)) {
    return draggableInstances.value.get(cardId)?.style || ''
  }

  // Calculate initial position with some offset based on index
  const initialX = 40 + index * 10
  const initialY = 40

  const instance = useDraggable(cardRef, {
    initialValue: { x: initialX, y: initialY },
    preventDefault: true,
    containerElement: container,
    onStart: () => {
      if (!cardZIndexOrder.value.includes(cardId)) {
        cardZIndexOrder.value.push(cardId)
      } else {
        cardZIndexOrder.value = cardZIndexOrder.value.filter((id) => id !== cardId)
        cardZIndexOrder.value.push(cardId)
      }
    },
  })

  // @ts-expect-error - Type mismatch is expected here but works at runtime
  draggableInstances.value.set(cardId, instance)
  return instance.style.value
}

const inspectedCard = ref<YugiohCard | null>(null)
const cardSize = ref(5)

const resetCardPositions = () => {
  cardZIndexOrder.value = []
  // Reset all card positions to their default values
  draggableInstances.value.forEach((instance, cardId) => {
    const index = Array.from(draggableInstances.value.keys()).indexOf(cardId)
    const initialX = 40 + index * 10
    const initialY = 40
    instance.x = initialX
    instance.y = initialY
  })
}
</script>

<template>
  <div class="p-8">
    <div class="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-end">
      <div class="flex flex-col items-start rounded-md border-1 border-gray-300 p-4">
        <h3 class="text-2xl">Decks</h3>
        <div class="mt-2 flex max-w-full flex-wrap gap-2" v-if="decks.length">
          <div
            v-for="deck in decks"
            :key="deck.id"
            class="flex max-w-full cursor-pointer items-center rounded-md border-1 border-gray-300 p-2"
            :class="{ 'bg-neutral-700': selectedDeckId === deck.id }"
            @click="selectedDeckId = deck.id"
          >
            <h4 class="overflow-hidden text-xl font-semibold overflow-ellipsis">
              {{ deck.name }}
            </h4>
          </div>
        </div>
        <p v-else>No decks yet</p>
      </div>
    </div>

    <div class="mt-8 h-full">
      <!-- Main playground area -->
      <div class="min-h-screen">
        <div class="h-full rounded-lg shadow-md">
          <div class="flex justify-between">
            <h1 class="mb-4 text-2xl font-bold">Playground</h1>

            <div class="flex items-center gap-2 text-xl">
              <button
                class="flex size-8 items-center justify-center rounded-full border-1 border-gray-300 active:bg-gray-400"
                @click="cardSize--"
              >
                <span class="material-symbols-outlined text-sm"> remove </span>
              </button>
              <button
                class="flex size-8 items-center justify-center rounded-full border-1 border-gray-300 active:bg-gray-400"
                @click="cardSize++"
              >
                <span class="material-symbols-outlined text-sm"> add </span>
              </button>
              <button
                class="flex size-8 items-center justify-center rounded-full border-1 border-gray-300 active:bg-gray-400"
                @click="resetCardPositions"
              >
                <span class="material-symbols-outlined text-sm"> refresh </span>
              </button>
            </div>
          </div>
          <div ref="container" class="relative h-screen rounded-lg border border-gray-300">
            <template v-if="cardsInDeck && cardsInDeck.length > 0">
              <div
                v-for="(card, index) in cardsInDeck"
                :key="card.uid"
                :ref="(el) => cardRefs.set(card.uid, el as HTMLElement)"
                :style="`${cardStyles.get(card.uid) || initDraggable(card.uid, index)}; z-index: ${
                  cardZIndexOrder.indexOf(card.uid) + 1
                }`"
                class="absolute cursor-move"
                @click.right.prevent="inspectedCard = card"
              >
                <img
                  :src="
                    card.card_images && card.card_images.length > 0
                      ? card.card_images[0].image_url
                      : getS3ImageUrl(0)
                  "
                  :style="`width: ${cardSize}vw`"
                  :alt="card.name"
                />
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
    <inspect-modal v-if="inspectedCard" :cards="inspectedCard" @close="inspectedCard = null" />
  </div>
</template>
