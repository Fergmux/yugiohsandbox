<script setup lang="ts">
import InspectModal from '@/components/InspectModal.vue'
import { db } from '@/firebase/client'
import { useDeckStore } from '@/stores/deck'
import type { YugiohCard } from '@/types'
import { extraDeckTypes, otherDeckTypes } from '@/types'
import { getS3ImageUrl } from '@/utils'
import { useDraggable } from '@vueuse/core'
import { collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import _debounce from 'lodash/debounce'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import type { ComputedRef } from 'vue'
import { computed, ref, useTemplateRef, watch } from 'vue'

const deckStore = useDeckStore()
const { decks, allCards } = storeToRefs(deckStore)

const container = useTemplateRef<HTMLElement>('container')

interface CardLocation {
  x: number
  y: number
  z: number
  uid: string
  cardId: number
}

interface playgroundState {
  cardSize: number
  cardLocations: Record<string, CardLocation>
}

const playgroundState = ref<playgroundState>({
  cardSize: 5,
  cardLocations: {},
})

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
const fetchCompleted = ref(false)
watch(selectedDeckId, async () => {
  await getPlaygroundState()
  fetchCompleted.value = true
})
watch(
  () => playgroundState.value.cardSize,
  () => {
    updateState()
  },
)

const getPlaygroundState = async () => {
  const docRef = doc(db, 'playgrounds', selectedDeckId.value || '')
  const docSnap = await getDoc(docRef)
  if (docSnap.exists()) {
    const stateData = docSnap.data() as playgroundState
    playgroundState.value = stateData
  } else {
    // Create a new playground state document if it doesn't exist
    playgroundState.value = {
      cardSize: 5,
      cardLocations: {},
    }

    // Create a new document in the playgrounds collection
    const docRef = doc(collection(db, 'playgrounds'), selectedDeckId.value || '')
    try {
      await setDoc(docRef, playgroundState.value)
    } catch (error) {
      console.error('Error creating playground state:', error)
    }
  }
}

const updateState = _debounce(async () => {
  if (!selectedDeckId.value) return
  const docRef = doc(collection(db, 'playgrounds'), selectedDeckId.value)
  await updateDoc(docRef, playgroundState.value)
}, 1000)

// Get cards in the deck
const cardsInDeck: ComputedRef<YugiohCard[]> = computed(() => {
  let mainDeckX = 40
  let extraDeckX = 40

  return selectedDeck.value?.cards
    .map((cardId: number, index: number) => {
      const card = allCards.value.find((card) => card.id === cardId)
      if (card) {
        // Skip cards that are in otherDeckTypes
        if (otherDeckTypes.includes(card.type)) {
          return undefined
        }

        // Find if this card already has a location with a UID
        const existingLocation = Object.values(playgroundState.value.cardLocations).find(
          (location) => location.cardId === cardId,
        )

        // Use existing UID or generate a new one
        const uid = existingLocation?.uid || uuidv4()

        // If this is a new card, initialize its location data
        if (!existingLocation) {
          // Position extra deck cards on a lower row
          const isExtraDeck = extraDeckTypes.includes(card.type)
          const yPosition = isExtraDeck ? 120 : 40

          // Use separate X positions for main deck and extra deck
          let xPosition
          if (isExtraDeck) {
            xPosition = extraDeckX
            extraDeckX += 10 // Increment for the next extra deck card
          } else {
            xPosition = mainDeckX
            mainDeckX += 10 // Increment for the next main deck card
          }

          playgroundState.value.cardLocations[uid] = {
            x: xPosition,
            y: yPosition,
            z: index + 1,
            uid,
            cardId,
          }
        }

        return { ...card, uid }
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

// Create a map to store the draggable instances
const draggableInstances = ref<Map<string, ReturnType<typeof useDraggable>>>(new Map())

// Initialize draggable for each card
const initDraggable = (uid: string, index: number) => {
  const cardRef = cardRefs.value.get(uid)
  if (!cardRef) return ''

  // If we already have an instance for this card, return its style
  if (draggableInstances.value.has(uid)) {
    return draggableInstances.value.get(uid)?.style || ''
  }

  // Get or initialize card location
  if (!playgroundState.value.cardLocations[uid]) {
    const card = cardsInDeck.value.find((card) => card.uid === uid)
    if (!card) return ''

    // Position extra deck cards on a lower row
    const isExtraDeck = extraDeckTypes.includes(card.type)
    const yPosition = isExtraDeck ? 120 : 40
    const xOffset = isExtraDeck ? index * 10 : index * 10

    playgroundState.value.cardLocations[uid] = {
      x: 40 + xOffset,
      y: yPosition,
      z: index + 1,
      uid,
      cardId: card.id,
    }
  }

  const cardLocation = playgroundState.value.cardLocations[uid]

  const instance = useDraggable(cardRef, {
    initialValue: { x: cardLocation.x, y: cardLocation.y },
    preventDefault: true,
    containerElement: container,
    onStart: () => {
      // Find the highest z-index and increment it for the current card
      const highestZ = Object.values(playgroundState.value.cardLocations)
        .map((loc) => loc.z)
        .reduce((max, z) => Math.max(max, z), 0)

      // Update the z-index for this card
      playgroundState.value.cardLocations[uid].z = highestZ + 1
      updateState()
    },
    onMove: (event) => {
      playgroundState.value.cardLocations[uid].x = event.x
      playgroundState.value.cardLocations[uid].y = event.y
      updateState()
    },
  })

  // @ts-expect-error - Type mismatch is expected here but works at runtime
  draggableInstances.value.set(uid, instance)
  return instance.style.value
}

const inspectedCard = ref<YugiohCard | null>(null)

const resetCardPositions = () => {
  // Reset all card positions to their default values
  let mainDeckX = 40
  let extraDeckX = 40

  cardsInDeck.value.forEach((card, index) => {
    const uid = card.uid
    const instance = draggableInstances.value.get(uid)

    if (instance) {
      // Position extra deck cards on a lower row
      const isExtraDeck = extraDeckTypes.includes(card.type)
      const yPosition = isExtraDeck ? 120 : 40

      // Use separate X positions for main deck and extra deck
      let xPosition
      if (isExtraDeck) {
        xPosition = extraDeckX
        extraDeckX += 10 // Increment for the next extra deck card
      } else {
        xPosition = mainDeckX
        mainDeckX += 10 // Increment for the next main deck card
      }

      instance.x = xPosition
      instance.y = yPosition

      // Update the stored positions
      if (playgroundState.value.cardLocations[uid]) {
        playgroundState.value.cardLocations[uid].x = xPosition
        playgroundState.value.cardLocations[uid].y = yPosition
        playgroundState.value.cardLocations[uid].z = index + 1
      }
    }
  })
  updateState()
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

    <div v-if="fetchCompleted" class="mt-8 h-full">
      <!-- Main playground area -->
      <div class="min-h-screen">
        <div class="h-full rounded-lg shadow-md">
          <div class="flex justify-between">
            <h1 class="mb-4 text-2xl font-bold">Playground</h1>

            <div class="flex items-center gap-2 text-xl">
              <button
                class="flex size-8 items-center justify-center rounded-full border-1 border-gray-300 active:bg-gray-400"
                @click="playgroundState.cardSize--"
              >
                <span class="material-symbols-outlined text-sm"> remove </span>
              </button>
              <button
                class="flex size-8 items-center justify-center rounded-full border-1 border-gray-300 active:bg-gray-400"
                @click="playgroundState.cardSize++"
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
                  playgroundState.cardLocations[card.uid]?.z || index + 1
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
                  :style="`width: ${playgroundState.cardSize}vw`"
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
