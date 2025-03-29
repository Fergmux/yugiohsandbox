<script setup lang="ts">
import type { ComputedRef } from 'vue'
// Fetch all cards and decks on component mount
import {
  computed,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from 'vue'

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import _debounce from 'lodash/debounce'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'

import InspectModal from '@/components/InspectModal.vue'
import { db } from '@/firebase/client'
import { useDeckStore } from '@/stores/deck'
import type { YugiohCard } from '@/types'
import {
  extraDeckTypes,
  otherDeckTypes,
} from '@/types'
import { getS3ImageUrl } from '@/utils'
import { useDraggable } from '@vueuse/core'

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
  // Clear caches
  cardStyles.value.clear()
  draggableInstances.value.clear()
  cardRefs.value.clear()

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

// Selection rectangle state
const isSelecting = ref(false)
const selectionStart = ref({ x: 0, y: 0 })
const selectionEnd = ref({ x: 0, y: 0 })
const selectedCards = ref<string[]>([])

// Track if a card is being dragged
const isDragging = ref(false)

// Selection rectangle computed properties
const selectionRect = computed(() => {
  const left = Math.min(selectionStart.value.x, selectionEnd.value.x)
  const top = Math.min(selectionStart.value.y, selectionEnd.value.y)
  const width = Math.abs(selectionEnd.value.x - selectionStart.value.x)
  const height = Math.abs(selectionEnd.value.y - selectionStart.value.y)

  return { left, top, width, height }
})

// Check if a card is within the selection rectangle
const isCardInSelection = (uid: string) => {
  const cardLocation = playgroundState.value.cardLocations[uid]
  if (!cardLocation) return false

  const cardWidth = (playgroundState.value.cardSize * window.innerWidth) / 100
  const cardHeight = cardWidth * 1.45 // Approximate card aspect ratio

  const cardRect = {
    left: cardLocation.x,
    top: cardLocation.y,
    right: cardLocation.x + cardWidth,
    bottom: cardLocation.y + cardHeight,
  }

  const selRect = {
    left: selectionRect.value.left,
    top: selectionRect.value.top,
    right: selectionRect.value.left + selectionRect.value.width,
    bottom: selectionRect.value.top + selectionRect.value.height,
  }

  // Check for intersection
  return !(
    cardRect.left > selRect.right ||
    cardRect.right < selRect.left ||
    cardRect.top > selRect.bottom ||
    cardRect.bottom < selRect.top
  )
}

// Handle mouse events for selection rectangle
const startSelection = (event: MouseEvent) => {
  // Only start selection on left click and not on cards
  if (event.button !== 0 || (event.target as HTMLElement).closest('.card-element')) return

  const containerRect = container.value?.getBoundingClientRect()
  if (!containerRect) return

  isSelecting.value = true
  selectionStart.value = {
    x: event.clientX - containerRect.left,
    y: event.clientY - containerRect.top,
  }
  selectionEnd.value = { ...selectionStart.value }

  // Clear selection when starting a new selection
  selectedCards.value = []
}

const updateSelection = (event: MouseEvent) => {
  if (!isSelecting.value) return

  const containerRect = container.value?.getBoundingClientRect()
  if (!containerRect) return

  selectionEnd.value = {
    x: event.clientX - containerRect.left,
    y: event.clientY - containerRect.top,
  }

  // Update selected cards in real-time as the selection rectangle changes
  selectedCards.value = Object.keys(playgroundState.value.cardLocations).filter(isCardInSelection)
}

const endSelection = () => {
  if (!isSelecting.value) return

  // We don't need to update selectedCards here anymore since it's already updated in updateSelection
  isSelecting.value = false
}

// Clear selection
const clearSelection = () => {
  selectedCards.value = []
}

// Handle card selection
const toggleCardSelection = (uid: string, event: MouseEvent) => {
  // Prevent default to avoid triggering other events
  event.preventDefault()

  // Don't select if we're currently dragging
  if (isDragging.value) return

  // If shift key is pressed, add/remove the card from the current selection
  if (event.shiftKey) {
    if (selectedCards.value.includes(uid)) {
      // Remove the card from selection
      selectedCards.value = selectedCards.value.filter((id) => id !== uid)
    } else {
      // Add the card to selection
      selectedCards.value.push(uid)
    }
  } else {
    // If shift key is not pressed, select only this card
    if (selectedCards.value.length === 1 && selectedCards.value[0] === uid) {
      // If the card is already the only selected one, deselect it
      selectedCards.value = []
    } else {
      // Otherwise, select only this card
      selectedCards.value = [uid]
    }
  }
}

// Initialize draggable for each card
const initDraggable = (uid: string, index: number) => {
  const cardRef = cardRefs.value.get(uid)
  if (!cardRef) return ''

  // If we already have an instance for this card, return its current style
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

  // Track initial position to detect actual movement
  const initialPosition = { x: 0, y: 0 }
  let hasMoved = false

  const instance = useDraggable(cardRef, {
    initialValue: { x: cardLocation.x, y: cardLocation.y },
    preventDefault: true,
    containerElement: container,
    onStart: (position) => {
      // Store initial position
      initialPosition.x = position.x
      initialPosition.y = position.y
      hasMoved = false

      // Find the highest z-index and increment it for the current card
      const highestZ = Object.values(playgroundState.value.cardLocations)
        .map((loc) => loc.z)
        .reduce((max, z) => Math.max(max, z), 0)

      // Update the z-index for this card
      playgroundState.value.cardLocations[uid].z = highestZ + 1

      // If this card is part of a selection, bring all selected cards to front
      if (selectedCards.value.includes(uid)) {
        selectedCards.value.forEach((selectedUid, i) => {
          if (selectedUid !== uid) {
            playgroundState.value.cardLocations[selectedUid].z = highestZ + 2 + i
          }
        })
      }

      updateState()
    },
    onMove: (event) => {
      // Check if the card has actually moved a significant amount
      const deltaX = Math.abs(event.x - initialPosition.x)
      const deltaY = Math.abs(event.y - initialPosition.y)

      // Consider it a drag if moved more than 3 pixels in any direction
      if (deltaX > 3 || deltaY > 3) {
        hasMoved = true
        isDragging.value = true
      }

      // Calculate the movement delta from last position
      const moveX = event.x - playgroundState.value.cardLocations[uid].x
      const moveY = event.y - playgroundState.value.cardLocations[uid].y

      // Update the position of the current card
      playgroundState.value.cardLocations[uid].x = event.x
      playgroundState.value.cardLocations[uid].y = event.y

      // If this card is part of a selection, move all selected cards
      if (selectedCards.value.includes(uid)) {
        selectedCards.value.forEach((selectedUid) => {
          if (selectedUid !== uid) {
            // Move other selected cards by the same delta
            playgroundState.value.cardLocations[selectedUid].x += moveX
            playgroundState.value.cardLocations[selectedUid].y += moveY

            // Update the draggable instance position
            const selectedInstance = draggableInstances.value.get(selectedUid)
            if (selectedInstance) {
              selectedInstance.position.x = playgroundState.value.cardLocations[selectedUid].x
              selectedInstance.position.y = playgroundState.value.cardLocations[selectedUid].y
            }
          }
        })
      }

      updateState()
    },
    onEnd: () => {
      // Only reset isDragging if the card actually moved
      if (hasMoved) {
        setTimeout(() => {
          isDragging.value = false
        }, 50)
      } else {
        // If the card didn't move, it's just a click, not a drag
        isDragging.value = false
      }
    },
  })

  // Store the instance
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

      instance.position.x = xPosition
      instance.position.y = yPosition

      // Update the stored positions
      if (playgroundState.value.cardLocations[uid]) {
        playgroundState.value.cardLocations[uid].x = xPosition
        playgroundState.value.cardLocations[uid].y = yPosition
        playgroundState.value.cardLocations[uid].z = index + 1
      }
    }
  })

  // Clear selection
  clearSelection()
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
              <button
                class="flex size-8 items-center justify-center rounded-full border-1 border-gray-300 active:bg-gray-400"
                @click="clearSelection"
              >
                <span class="material-symbols-outlined text-sm"> clear </span>
              </button>
            </div>
          </div>
          <div
            ref="container"
            class="relative h-screen rounded-lg border border-gray-300"
            @mousedown="startSelection"
            @mousemove="updateSelection"
            @mouseup="endSelection"
            @mouseleave="endSelection"
          >
            <!-- Selection rectangle -->
            <div
              v-if="isSelecting"
              class="absolute border-2 border-blue-500 bg-blue-200 opacity-30"
              :style="{
                left: `${selectionRect.left}px`,
                top: `${selectionRect.top}px`,
                width: `${selectionRect.width}px`,
                height: `${selectionRect.height}px`,
                pointerEvents: 'none',
              }"
            ></div>

            <template v-if="cardsInDeck && cardsInDeck.length > 0">
              <div
                v-for="(card, index) in cardsInDeck"
                :key="card.uid"
                :ref="(el) => cardRefs.set(card.uid, el as HTMLElement)"
                :style="`${draggableInstances.get(card.uid)?.style || initDraggable(card.uid, index)}; z-index: ${
                  playgroundState.cardLocations[card.uid]?.z || index + 1
                }`"
                class="card-element absolute cursor-move"
                :class="{ 'selected-card': selectedCards.includes(card.uid) }"
                @click="toggleCardSelection(card.uid, $event)"
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
                  class="select-none"
                />
                <div
                  v-if="selectedCards.includes(card.uid)"
                  class="pointer-events-none absolute inset-0 border-4 border-blue-500"
                ></div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
    <inspect-modal v-if="inspectedCard" :cards="inspectedCard" @close="inspectedCard = null" />
  </div>
</template>
