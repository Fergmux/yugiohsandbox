<script setup lang="ts">
import type { ComputedRef } from 'vue'
// Fetch all cards and decks on component mount
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'

import { collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import _debounce from 'lodash/debounce'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'

import DeckSelect from '@/components/deckbuilder/DeckSelect.vue'
import InspectModal from '@/components/InspectModal.vue'
import { db } from '@/firebase/client'
import { useDeckStore } from '@/stores/deck'
import { extraDeckTypes, otherDeckTypes } from '@/types/filters'
import type { YugiohCard } from '@/types/yugiohCard'
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

interface TextElement {
  text: string
  x: number
  y: number
  uid: string
  z: number
  fontSize?: number // Add optional fontSize property
}

interface playgroundState {
  cardSize: number
  cardLocations: Record<string, CardLocation>
  zoomLevel: number
  textElements: TextElement[]
}

const playgroundState = ref<playgroundState>({
  cardSize: 120, // Base card size in pixels
  cardLocations: {},
  zoomLevel: 1,
  textElements: [],
})

// Computed property for the actual display size of cards after zoom is applied
const displayCardSize = computed(() => {
  return playgroundState.value.cardSize * playgroundState.value.zoomLevel
})

onMounted(async () => {
  await deckStore.getAllCards()

  // Wait for container to be available before adding event listener
  watch(
    () => container.value,
    (newContainer) => {
      if (newContainer) {
        newContainer.addEventListener('wheel', handleZoom, { passive: false })
      }
    },
    { immediate: true },
  )
})

onUnmounted(() => {
  if (container.value) {
    container.value.removeEventListener('wheel', handleZoom)
  }
})

// Handle zoom with mouse wheel when Ctrl/Cmd is pressed
const handleZoom = (event: WheelEvent) => {
  // Only zoom if Ctrl (Windows) or Cmd (Mac) key is pressed
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()

    // Determine zoom direction
    const zoomDirection = event.deltaY < 0 ? 1 : -1

    // Get mouse position relative to container for zoom origin
    const containerRect = container.value?.getBoundingClientRect()
    if (!containerRect) return

    const mouseX = event.clientX - containerRect.left
    const mouseY = event.clientY - containerRect.top

    // Calculate new zoom level
    const zoomFactor = 0.1
    const oldZoom = playgroundState.value.zoomLevel
    const newZoom = Math.max(0.5, Math.min(3, oldZoom + zoomDirection * zoomFactor))

    // Update card positions based on zoom change
    const zoomRatio = newZoom / oldZoom

    // Update all card positions relative to mouse position
    Object.keys(playgroundState.value.cardLocations).forEach((uid) => {
      const card = playgroundState.value.cardLocations[uid]

      // Calculate position relative to mouse
      const dx = card.x - mouseX
      const dy = card.y - mouseY

      // Apply zoom transformation
      card.x = mouseX + dx * zoomRatio
      card.y = mouseY + dy * zoomRatio

      // Update draggable instance if it exists
      const instance = draggableInstances.value.get(uid)
      if (instance) {
        instance.position.x = card.x
        instance.position.y = card.y
      }
    })

    // Update text element positions relative to mouse position
    if (Array.isArray(textElements.value)) {
      textElements.value.forEach((textElement) => {
        // Calculate position relative to mouse
        const dx = textElement.x - mouseX
        const dy = textElement.y - mouseY

        // Apply zoom transformation
        textElement.x = mouseX + dx * zoomRatio
        textElement.y = mouseY + dy * zoomRatio

        // Update draggable instance if it exists
        const instance = draggableInstances.value.get(textElement.uid)
        if (instance) {
          instance.position.x = textElement.x
          instance.position.y = textElement.y
        }
      })
    }

    // Update zoom level
    playgroundState.value.zoomLevel = newZoom

    updateState()
  }
}

// Deck selection
const selectedDeckId = ref<string | undefined>()

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
    playgroundState.value = {
      ...stateData,
      zoomLevel: stateData.zoomLevel || 1, // Ensure zoomLevel exists
      cardSize: stateData.cardSize || 120, // Ensure cardSize exists with default of 120px
      textElements: stateData.textElements || [], // Ensure textElements exists
    }

    // If cardSize is too small or undefined, set it to the default
    if (!playgroundState.value.cardSize || playgroundState.value.cardSize < 40) {
      playgroundState.value.cardSize = 120
    }

    // Load text elements from state
    textElements.value = Array.isArray(playgroundState.value.textElements) ? playgroundState.value.textElements : []

    // Load font sizes from text elements
    textElementFontSizes.value = {}
    textElements.value.forEach((element) => {
      if (element.fontSize) {
        textElementFontSizes.value[element.uid] = element.fontSize
      }
    })
  } else {
    // Create a new playground state document if it doesn't exist
    playgroundState.value = {
      cardSize: 120, // Changed from 5 to 120 pixels default size
      cardLocations: {},
      zoomLevel: 1,
      textElements: [], // Initialize with empty text elements array
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

  // Update text elements in playgroundState before saving
  // Ensure textElements.value is an array before storing
  playgroundState.value.textElements = Array.isArray(textElements.value) ? textElements.value : []

  const docRef = doc(collection(db, 'playgrounds'), selectedDeckId.value)
  await updateDoc(docRef, playgroundState.value)
}, 1000)

// Debounced function to save text element changes
const saveTextElement = _debounce(() => {
  // Save font sizes for text elements in the state
  textElements.value.forEach((element) => {
    if (textElementFontSizes.value[element.uid]) {
      // Store font size in the fontSize property
      element.fontSize = textElementFontSizes.value[element.uid]
    }
  })

  updateState()
}, 1000)

const cardsOnField: ComputedRef<YugiohCard[]> = computed(() => {
  if (!selectedDeck.value) return []

  let mainDeckX = 40
  let extraDeckX = 40
  const result: YugiohCard[] = []

  // Process each card in the selected deck
  selectedDeck.value.cards.forEach((cardId: number, index: number) => {
    const card = allCards.value.find((card) => card.id === cardId)
    if (!card || otherDeckTypes.includes(card.type)) return

    // Check if this card already has a position in the playground state
    const existingLocation = Object.values(playgroundState.value.cardLocations).find(
      (location) => location.cardId === cardId,
    )

    if (existingLocation) {
      // Use the existing location and uid
      result.push({ ...card, uid: existingLocation.uid })
    } else {
      // Generate a new UID and position for this card
      const uid = uuidv4()

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

      // Add the new card location to the playground state
      playgroundState.value.cardLocations[uid] = {
        x: xPosition,
        y: yPosition,
        z: index + 1,
        uid,
        cardId,
      }

      result.push({ ...card, uid })
    }
  })

  // Sort the cards by frame type
  return result.sort((a, b) => a.frameType.localeCompare(b.frameType)).filter(Boolean) as YugiohCard[]
})

// Create refs for each card element
const cardRefs = ref<Map<string, HTMLElement | null>>(new Map())

// Create a map to store the style for each card
const cardStyles = ref<Map<string, string>>(new Map())

// Create a map to store the draggable instances
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const draggableInstances = ref<Map<string, any>>(new Map())

// Properly initialize textElements
const textElements = ref<TextElement[]>([])

// Selected text element reference
const selectedTextElement = ref<string | null>(null)

// Track the text elements that are selected via drag selection
const selectedTextElements = ref<string[]>([])

// Selection rectangle state
const isSelecting = ref(false)
const selectionStart = ref({ x: 0, y: 0 })
const selectionEnd = ref({ x: 0, y: 0 })
const selectedCards = ref<string[]>([])

// Track if a card is being dragged
const isDragging = ref(false)

// Pan functionality
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })
const lastPanPosition = ref({ x: 0, y: 0 })

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

  const cardWidth = displayCardSize.value // Use computed display size
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

// Check if a text element is within the selection rectangle
const isTextElementInSelection = (uid: string) => {
  const textElement = textElements.value.find((el) => el.uid === uid)
  if (!textElement) return false

  // Get the text element's dimensions (approximate)
  const textRef = textRefs.value.get(uid)
  if (!textRef) return false

  const textRect = textRef.getBoundingClientRect()
  const containerRect = container.value?.getBoundingClientRect()
  if (!containerRect) return false

  // Convert to container coordinates
  const textElementRect = {
    left: textElement.x,
    top: textElement.y,
    right: textElement.x + textRect.width,
    bottom: textElement.y + textRect.height,
  }

  const selRect = {
    left: selectionRect.value.left,
    top: selectionRect.value.top,
    right: selectionRect.value.left + selectionRect.value.width,
    bottom: selectionRect.value.top + selectionRect.value.height,
  }

  // Check for intersection
  return !(
    textElementRect.left > selRect.right ||
    textElementRect.right < selRect.left ||
    textElementRect.top > selRect.bottom ||
    textElementRect.bottom < selRect.top
  )
}

// Handle mouse events for selection rectangle
const startSelection = (event: MouseEvent) => {
  // If right mouse button is pressed, start panning instead
  if (event.button === 2) {
    event.preventDefault()
    startPanning(event)
    return
  }

  // Deselect text element when clicking anywhere else
  const clickedOnTextElement = (event.target as HTMLElement).closest('.text-element')
  if (!clickedOnTextElement && !event.shiftKey) {
    selectedTextElement.value = null
    selectedTextElements.value = []
  }

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

  // Clear selection when starting a new selection (unless using Shift)
  if (!event.shiftKey) {
    selectedCards.value = []
  }
}

const updateSelection = (event: MouseEvent) => {
  // If panning, handle pan movement instead
  if (isPanning.value) {
    updatePanning(event)
    return
  }

  if (!isSelecting.value) return

  const containerRect = container.value?.getBoundingClientRect()
  if (!containerRect) return

  selectionEnd.value = {
    x: event.clientX - containerRect.left,
    y: event.clientY - containerRect.top,
  }

  // Update selected cards in real-time as the selection rectangle changes
  selectedCards.value = Object.keys(playgroundState.value.cardLocations).filter(isCardInSelection)

  // Also update selected text elements
  selectedTextElements.value = textElements.value
    .filter((element) => isTextElementInSelection(element.uid))
    .map((element) => element.uid)

  // Set the primary selected text element to the first one in the selection (if any)
  if (selectedTextElements.value.length > 0) {
    selectedTextElement.value = selectedTextElements.value[0]
  } else {
    selectedTextElement.value = null
  }
}

const endSelection = () => {
  // End panning if it was active
  if (isPanning.value) {
    endPanning()
    return
  }

  if (!isSelecting.value) return

  // We don't need to update selectedCards here anymore since it's already updated in updateSelection
  isSelecting.value = false
}

// Pan functionality
const startPanning = (event: MouseEvent) => {
  const containerRect = container.value?.getBoundingClientRect()
  if (!containerRect) return

  isPanning.value = true
  panStart.value = {
    x: event.clientX,
    y: event.clientY,
  }
  lastPanPosition.value = { ...panStart.value }

  // Add a class to change cursor during panning
  if (container.value) {
    container.value.classList.add('panning')
  }
}

const updatePanning = (event: MouseEvent) => {
  if (!isPanning.value) return

  // Calculate the movement delta
  const deltaX = event.clientX - lastPanPosition.value.x
  const deltaY = event.clientY - lastPanPosition.value.y

  // Update all card positions
  Object.keys(playgroundState.value.cardLocations).forEach((uid) => {
    const card = playgroundState.value.cardLocations[uid]

    // Move the card by the delta
    card.x += deltaX
    card.y += deltaY

    // Update the draggable instance if it exists
    const instance = draggableInstances.value.get(uid)
    if (instance) {
      instance.position.x = card.x
      instance.position.y = card.y
    }
  })

  // Update all text element positions
  if (Array.isArray(textElements.value)) {
    textElements.value.forEach((textElement) => {
      // Move the text element by the delta
      textElement.x += deltaX
      textElement.y += deltaY

      // Update the draggable instance if it exists
      const instance = draggableInstances.value.get(textElement.uid)
      if (instance) {
        instance.position.x = textElement.x
        instance.position.y = textElement.y
      }
    })
  }

  // Update the last position for the next movement
  lastPanPosition.value = {
    x: event.clientX,
    y: event.clientY,
  }

  updateState()
}

const endPanning = () => {
  isPanning.value = false

  // Remove the panning cursor class
  if (container.value) {
    container.value.classList.remove('panning')
  }
}

// Clear selection
const clearSelection = () => {
  selectedCards.value = []
  selectedTextElements.value = []
}

// Handle card selection
const toggleCardSelection = (uid: string, event: MouseEvent) => {
  // Prevent default to avoid triggering other events
  event.preventDefault()

  // Force any active element to blur (defocus text inputs)
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }

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
    // Keep text selection with Shift key
  } else {
    // If shift key is not pressed, select only this card
    if (selectedCards.value.length === 1 && selectedCards.value[0] === uid) {
      // If the card is already the only selected one, deselect it
      selectedCards.value = []
    } else {
      // Otherwise, select only this card
      selectedCards.value = [uid]
    }

    // Clear any selected text element when selecting a card without Shift
    selectedTextElement.value = null
    selectedTextElements.value = []
  }

  // Ensure the draggable instance position matches the stored position
  const instance = draggableInstances.value.get(uid)
  if (instance && playgroundState.value.cardLocations[uid]) {
    instance.position.x = playgroundState.value.cardLocations[uid].x
    instance.position.y = playgroundState.value.cardLocations[uid].y
  }
}
// Snapping functionality
const isSnappingEnabled = ref(true)
const snapThreshold = 30 // Distance in pixels to trigger snapping
const snapHighlightedEdges = ref<{
  edges: { [cardUid: string]: { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean } }
}>({ edges: {} })

// Get card dimensions
const getCardDimensions = (uid: string) => {
  const cardWidth = displayCardSize.value // Use computed display size
  const cardHeight = cardWidth * 1.45 // Approximate card aspect ratio
  const cardLocation = playgroundState.value.cardLocations[uid]

  return {
    left: cardLocation.x,
    top: cardLocation.y,
    right: cardLocation.x + cardWidth,
    bottom: cardLocation.y + cardHeight,
    width: cardWidth,
    height: cardHeight,
  }
}
// Check for snap opportunities
const checkForSnap = (draggedUid: string) => {
  if (!isSnappingEnabled.value) {
    // Clear any highlighted edges
    snapHighlightedEdges.value = { edges: {} }
    return null
  }

  const draggedCard = getCardDimensions(draggedUid)

  // Reset highlighted edges
  snapHighlightedEdges.value = { edges: {} }

  // Track all potential snaps across all cards
  const allSnaps: Array<{
    cardUid: string
    edge: string
    targetEdge: string
    snapTo: number
    isHorizontal: boolean
    distance: number
  }> = []

  // Check against all other cards
  Object.keys(playgroundState.value.cardLocations).forEach((uid) => {
    // Skip if this is the dragged card or if it's a selected card (unless the dragged card isn't selected)
    if (uid === draggedUid || (selectedCards.value.includes(uid) && selectedCards.value.includes(draggedUid))) return

    const targetCard = getCardDimensions(uid)

    // Calculate the center points of both cards
    const draggedCenterX = draggedCard.left + draggedCard.width / 2
    const draggedCenterY = draggedCard.top + draggedCard.height / 2
    const targetCenterX = targetCard.left + targetCard.width / 2
    const targetCenterY = targetCard.top + targetCard.height / 2

    // Calculate distance between card centers
    const centerDistance = Math.sqrt(
      Math.pow(draggedCenterX - targetCenterX, 2) + Math.pow(draggedCenterY - targetCenterY, 2),
    )

    // Skip if cards are too far apart (using card width/height as a reference)
    const proximityThreshold = Math.max(draggedCard.width, draggedCard.height) * 1.5
    if (centerDistance > proximityThreshold) return

    // Check all possible edge combinations for snapping
    const edges = [
      { draggedEdge: 'left', draggedPos: draggedCard.left, isHorizontal: true },
      { draggedEdge: 'right', draggedPos: draggedCard.right, isHorizontal: true },
      { draggedEdge: 'top', draggedPos: draggedCard.top, isHorizontal: false },
      { draggedEdge: 'bottom', draggedPos: draggedCard.bottom, isHorizontal: false },
    ]

    const targetEdges = [
      { targetEdge: 'left', targetPos: targetCard.left, isHorizontal: true },
      { targetEdge: 'right', targetPos: targetCard.right, isHorizontal: true },
      { targetEdge: 'top', targetPos: targetCard.top, isHorizontal: false },
      { targetEdge: 'bottom', targetPos: targetCard.bottom, isHorizontal: false },
    ]

    // Check all edge combinations
    for (const { draggedEdge, draggedPos, isHorizontal } of edges) {
      for (const { targetEdge, targetPos } of targetEdges) {
        // Only compare edges of the same orientation (horizontal with horizontal, vertical with vertical)
        const targetIsHorizontal = targetEdge === 'left' || targetEdge === 'right'
        if (isHorizontal !== targetIsHorizontal) continue

        const distance = Math.abs(draggedPos - targetPos)

        if (distance < snapThreshold) {
          // Calculate the position to snap to
          let snapTo = 0

          if (draggedEdge === 'left') {
            snapTo = targetPos
          } else if (draggedEdge === 'right') {
            snapTo = targetPos - draggedCard.width
          } else if (draggedEdge === 'top') {
            snapTo = targetPos
          } else if (draggedEdge === 'bottom') {
            snapTo = targetPos - draggedCard.height
          }

          allSnaps.push({
            cardUid: uid,
            edge: draggedEdge,
            targetEdge: targetEdge,
            snapTo: snapTo,
            isHorizontal,
            distance: distance + centerDistance,
          })
        }
      }
    }
  })

  // If we have no snaps, return null
  if (allSnaps.length === 0) {
    return null
  }

  // Sort snaps by distance (closest first)
  allSnaps.sort((a, b) => a.distance - b.distance)

  // Find the best horizontal and vertical snaps (which may be from different cards)
  const horizontalSnaps = allSnaps.filter((snap) => snap.isHorizontal)
  const verticalSnaps = allSnaps.filter((snap) => !snap.isHorizontal)

  const bestHorizontalSnap = horizontalSnaps.length > 0 ? horizontalSnaps[0] : null
  const bestVerticalSnap = verticalSnaps.length > 0 ? verticalSnaps[0] : null

  // Highlight the edges that will be snapped to
  const highlightedEdges: Record<string, Record<string, boolean>> = {}

  // Add horizontal edge highlight if available
  if (bestHorizontalSnap) {
    if (!highlightedEdges[bestHorizontalSnap.cardUid]) {
      highlightedEdges[bestHorizontalSnap.cardUid] = {}
    }
    highlightedEdges[bestHorizontalSnap.cardUid][bestHorizontalSnap.targetEdge] = true
  }

  // Add vertical edge highlight if available
  if (bestVerticalSnap) {
    if (!highlightedEdges[bestVerticalSnap.cardUid]) {
      highlightedEdges[bestVerticalSnap.cardUid] = {}
    }
    highlightedEdges[bestVerticalSnap.cardUid][bestVerticalSnap.targetEdge] = true
  }

  // Apply highlights to all relevant cards
  snapHighlightedEdges.value.edges = highlightedEdges

  // Return the best snaps
  return {
    horizontal: bestHorizontalSnap
      ? {
          targetUid: bestHorizontalSnap.cardUid,
          edge: bestHorizontalSnap.edge,
          targetEdge: bestHorizontalSnap.targetEdge,
          snapTo: bestHorizontalSnap.snapTo,
          isHorizontal: bestHorizontalSnap.isHorizontal,
        }
      : null,
    vertical: bestVerticalSnap
      ? {
          targetUid: bestVerticalSnap.cardUid,
          edge: bestVerticalSnap.edge,
          targetEdge: bestVerticalSnap.targetEdge,
          snapTo: bestVerticalSnap.snapTo,
          isHorizontal: bestVerticalSnap.isHorizontal,
        }
      : null,
  }
}

// Apply snap
const applySnap = (
  draggedUid: string,
  snap: {
    horizontal?: {
      targetUid: string
      edge: string
      targetEdge: string
      snapTo: number
      isHorizontal: boolean
    } | null
    vertical?: {
      targetUid: string
      edge: string
      targetEdge: string
      snapTo: number
      isHorizontal: boolean
    } | null
  },
) => {
  const draggedCard = playgroundState.value.cardLocations[draggedUid]
  const draggedInstance = draggableInstances.value.get(draggedUid)

  if (!draggedCard || !draggedInstance) return

  // Calculate the movement delta
  let deltaX = 0
  let deltaY = 0

  // Apply horizontal snap if available
  if (snap.horizontal) {
    deltaX = snap.horizontal.snapTo - draggedCard.x
  }

  // Apply vertical snap if available
  if (snap.vertical) {
    deltaY = snap.vertical.snapTo - draggedCard.y
  }

  // Move the dragged card
  draggedCard.x += deltaX
  draggedCard.y += deltaY
  draggedInstance.position.x = draggedCard.x
  draggedInstance.position.y = draggedCard.y

  // Move all selected cards by the same delta
  if (selectedCards.value.includes(draggedUid)) {
    selectedCards.value.forEach((selectedUid) => {
      if (selectedUid !== draggedUid) {
        const selectedCard = playgroundState.value.cardLocations[selectedUid]
        const selectedInstance = draggableInstances.value.get(selectedUid)

        if (selectedCard && selectedInstance) {
          selectedCard.x += deltaX
          selectedCard.y += deltaY
          selectedInstance.position.x = selectedCard.x
          selectedInstance.position.y = selectedCard.y
        }
      }
    })
  }

  // Clear highlighted edges
  snapHighlightedEdges.value = { edges: {} }
}

// Toggle snapping
const toggleSnapping = () => {
  isSnappingEnabled.value = !isSnappingEnabled.value
}

// Initialize draggable for each card
const initDraggable = (uid: string, index: number) => {
  const cardRef = cardRefs.value.get(uid)
  if (!cardRef) return ''

  // If we already have an instance for this card, return its current style
  if (draggableInstances.value.has(uid)) {
    const instance = draggableInstances.value.get(uid)
    // Ensure the instance's position matches the stored position
    if (instance && playgroundState.value.cardLocations[uid]) {
      instance.position.x = playgroundState.value.cardLocations[uid].x
      instance.position.y = playgroundState.value.cardLocations[uid].y
    }
    return instance?.style || ''
  }

  // Get or initialize card location
  if (!playgroundState.value.cardLocations[uid]) {
    const card = cardsOnField.value.find((card) => card.uid === uid)
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
  let currentSnap: ReturnType<typeof checkForSnap> | null = null
  let isJustSelecting = true

  const instance = useDraggable(cardRef, {
    initialValue: { x: cardLocation.x, y: cardLocation.y },
    preventDefault: true,
    stopPropagation: true,
    containerElement: container,
    onStart: (position) => {
      // Store initial position
      initialPosition.x = position.x
      initialPosition.y = position.y
      hasMoved = false
      isJustSelecting = true

      // Only change z-index if we're not just selecting
      if (!isJustSelecting) {
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
      }
    },
    onMove: (event) => {
      // Check if the card has actually moved a significant amount
      const deltaX = Math.abs(event.x - initialPosition.x)
      const deltaY = Math.abs(event.y - initialPosition.y)

      // Consider it a drag if moved more than 3 pixels in any direction
      if (deltaX > 3 || deltaY > 3) {
        hasMoved = true
        isDragging.value = true
        isJustSelecting = false
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

        // Also move any selected text elements
        selectedTextElements.value.forEach((selectedUid) => {
          const textIndex = textElements.value.findIndex((el) => el.uid === selectedUid)
          if (textIndex !== -1) {
            // Move the text element by the same delta
            textElements.value[textIndex].x += moveX
            textElements.value[textIndex].y += moveY

            // Update the draggable instance position
            const selectedInstance = draggableInstances.value.get(selectedUid)
            if (selectedInstance) {
              selectedInstance.position.x = textElements.value[textIndex].x
              selectedInstance.position.y = textElements.value[textIndex].y
            }
          }
        })
      }

      // Check for snap opportunities
      currentSnap = checkForSnap(uid)

      updateState()
    },
    onEnd: () => {
      // Apply snap if available
      if (currentSnap) {
        applySnap(uid, currentSnap)
        updateState()
      }

      // Only reset isDragging if the card actually moved
      if (hasMoved) {
        setTimeout(() => {
          isDragging.value = false
        }, 50)
      } else {
        // If the card didn't move, it's just a click, not a drag
        isDragging.value = false
      }

      // Clear any highlighted edges
      snapHighlightedEdges.value = { edges: {} }
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

  cardsOnField.value.forEach((card, index) => {
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

  // Get all text element UIDs before clearing
  const textElementUids = textElements.value?.map((element) => element.uid) || []

  // Clear all text elements (ensure it's done properly)
  textElements.value = []

  // Clear associated draggable instances
  textElementUids.forEach((uid) => {
    if (uid) {
      draggableInstances.value.delete(uid)
    }
  })

  // Update the text elements in the playground state
  playgroundState.value.textElements = []

  // Reset zoom level
  playgroundState.value.zoomLevel = 1
  // Keep the card base size as is

  // Clear selection
  clearSelection()
  updateState()
}

// Add function to change card size
const changeCardSize = (newSize: number) => {
  // Set the new card base size
  playgroundState.value.cardSize = newSize

  // Update the state in the database
  updateState()
}

const defaultTextElement: Omit<TextElement, 'uid'> = {
  text: 'Click to edit text',
  x: 0,
  y: 0,
  z: 1000, // Start text elements above cards
}

// Base font size for text elements (in pixels)
const baseFontSize = 16

// Individual text element font sizes
const textElementFontSizes = ref<Record<string, number>>({})

// Computed font size based on zoom level and individual element size
const getScaledFontSize = (uid: string) => {
  const baseFontSizeForElement = textElementFontSizes.value[uid] || baseFontSize
  return baseFontSizeForElement * playgroundState.value.zoomLevel
}

// Function to increase text size of selected element
const increaseTextSize = (e: MouseEvent) => {
  // Prevent default browser behavior that might affect focus
  e.preventDefault()

  if (!selectedTextElement.value) return

  const uid = selectedTextElement.value
  textElementFontSizes.value[uid] = (textElementFontSizes.value[uid] || baseFontSize) + 2
  saveTextElement()

  // Re-focus the text element
  const textElement = textRefs.value.get(uid)
  const editableElement = textElement?.querySelector('[contenteditable]') as HTMLDivElement | null
  if (editableElement) {
    editableElement.focus()
  }
}

// Function to decrease text size of selected element
const decreaseTextSize = (e: MouseEvent) => {
  // Prevent default browser behavior that might affect focus
  e.preventDefault()

  if (!selectedTextElement.value) return

  const uid = selectedTextElement.value
  const currentSize = textElementFontSizes.value[uid] || baseFontSize
  textElementFontSizes.value[uid] = Math.max(8, currentSize - 2) // Minimum 8px font size
  saveTextElement()

  // Re-focus the text element
  const textElement = textRefs.value.get(uid)
  const editableElement = textElement?.querySelector('[contenteditable]') as HTMLDivElement | null
  if (editableElement) {
    editableElement.focus()
  }
}

// Function to select text element
const selectTextElement = (uid: string, event?: MouseEvent) => {
  // Use Shift key for multi-select like with cards
  if (event?.shiftKey) {
    if (selectedTextElements.value.includes(uid)) {
      // Remove this text element from selection
      selectedTextElements.value = selectedTextElements.value.filter((id) => id !== uid)
      // Update primary selected element
      if (selectedTextElement.value === uid) {
        selectedTextElement.value = selectedTextElements.value.length > 0 ? selectedTextElements.value[0] : null
      }
    } else {
      // Add this text element to selection
      selectedTextElements.value.push(uid)
      // Set as primary selected element if there isn't one already
      if (!selectedTextElement.value) {
        selectedTextElement.value = uid
      }
    }
  } else {
    // Without Shift, select only this text element
    selectedTextElement.value = uid
    selectedTextElements.value = [uid]
    // Clear selected cards when selecting text without Shift
    selectedCards.value = []
  }

  // Focus the input element
  setTimeout(() => {
    const textElement = textRefs.value.get(uid)
    const editableElement = textElement?.querySelector('[contenteditable]') as HTMLDivElement | null
    if (editableElement) {
      editableElement.focus()

      // Move cursor to the end of the text
      const textElement = textElements.value.find((el) => el.uid === uid)
      if (textElement && textElement.text) {
        // Create a range at the end of the text content
        const range = document.createRange()
        const selection = window.getSelection()

        // First clear any existing selection
        selection?.removeAllRanges()

        // Set range to end of content
        if (editableElement.firstChild) {
          range.setStart(editableElement.firstChild, textElement.text.length)
          range.collapse(true)
          selection?.addRange(range)
        }
      }
    }
  }, 0)
}

const addTextElement = () => {
  // Ensure textElements.value is an array
  if (!Array.isArray(textElements.value)) {
    textElements.value = []
  }

  textElements.value.push({
    ...defaultTextElement,
    uid: uuidv4(),
    x: 100, // Default positions in the middle of the playground
    y: 100,
  })

  // Update the state to save the new text element
  updateState()
}

// Create refs for text elements
const textRefs = ref<Map<string, HTMLElement | null>>(new Map())

// Add a variable to track if we're currently dragging a text element
const isDraggingText = ref(false)

// Keep track of text elements that were recently dragged to prevent auto-select
const recentlyDragged = ref(new Set<string>())

// Initialize draggable for text elements
const initTextDraggable = (uid: string) => {
  const textRef = textRefs.value.get(uid)
  if (!textRef) return ''

  // If we already have an instance for this text element, return its current style
  if (draggableInstances.value.has(uid)) {
    const instance = draggableInstances.value.get(uid)
    // Ensure the instance's position matches the stored position
    const textElement = textElements.value.find((el) => el.uid === uid)
    if (instance && textElement) {
      instance.position.x = textElement.x
      instance.position.y = textElement.y
    }
    return instance?.style || ''
  }

  // Get the text element
  const textElement = textElements.value.find((el) => el.uid === uid)
  if (!textElement) return ''

  // Track initial position to detect actual movement
  const initialPosition = { x: 0, y: 0 }
  let hasMoved = false

  const instance = useDraggable(textRef, {
    initialValue: { x: textElement.x, y: textElement.y },
    preventDefault: true,
    stopPropagation: true,
    containerElement: container,
    onStart: (position) => {
      // Store initial position
      initialPosition.x = position.x
      initialPosition.y = position.y
      hasMoved = false
      isDraggingText.value = true

      // Clear the recently dragged flag when starting a new interaction
      recentlyDragged.value.delete(uid)

      // Only update the selection status, but don't focus the input yet
      if (!selectedTextElements.value.includes(uid)) {
        // Just update the selection state without focusing
        selectedTextElement.value = uid
        selectedTextElements.value = [uid]
        // Clear selected cards when selecting text without Shift
        selectedCards.value = []
      }

      // Make sure any active editable field loses focus during drag
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }

      // Find the highest z-index and increment it for the current element
      const cardZValues = Object.values(playgroundState.value.cardLocations).map((loc) => loc.z)
      const textZValues = textElements.value.map((el) => el.z)
      const allZValues = [...cardZValues, ...textZValues]
      const highestZ = allZValues.reduce((max, z) => Math.max(max, z), 0)

      // Update the z-index for this text element
      const index = textElements.value.findIndex((el) => el.uid === uid)
      if (index !== -1) {
        textElements.value[index].z = highestZ + 1
      }

      // If this text element is part of a selection, bring all selected text elements to front
      if (selectedTextElements.value.includes(uid)) {
        selectedTextElements.value.forEach((selectedUid, i) => {
          if (selectedUid !== uid) {
            const textIndex = textElements.value.findIndex((el) => el.uid === selectedUid)
            if (textIndex !== -1) {
              textElements.value[textIndex].z = highestZ + 2 + i
            }
          }
        })
      }
    },
    onMove: (event) => {
      // Check if the element has actually moved a significant amount
      const deltaX = Math.abs(event.x - initialPosition.x)
      const deltaY = Math.abs(event.y - initialPosition.y)

      // Consider it a drag if moved more than 3 pixels in any direction
      if (deltaX > 3 || deltaY > 3) {
        hasMoved = true
        isDragging.value = true

        // Make sure any active editable field loses focus during drag
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
      }

      // Get the current text element
      const index = textElements.value.findIndex((el) => el.uid === uid)
      if (index === -1) return

      // Calculate movement delta from last position
      const moveX = event.x - textElements.value[index].x
      const moveY = event.y - textElements.value[index].y

      // Update the position of the text element
      textElements.value[index].x = event.x
      textElements.value[index].y = event.y

      // If this text element is part of a selection, move all selected elements
      if (selectedTextElements.value.includes(uid)) {
        // Move other selected text elements
        selectedTextElements.value.forEach((selectedUid) => {
          if (selectedUid !== uid) {
            const textIndex = textElements.value.findIndex((el) => el.uid === selectedUid)
            if (textIndex !== -1) {
              textElements.value[textIndex].x += moveX
              textElements.value[textIndex].y += moveY

              // Update the draggable instance position
              const selectedInstance = draggableInstances.value.get(selectedUid)
              if (selectedInstance) {
                selectedInstance.position.x = textElements.value[textIndex].x
                selectedInstance.position.y = textElements.value[textIndex].y
              }
            }
          }
        })

        // Also move any selected cards
        selectedCards.value.forEach((selectedUid) => {
          const cardLocation = playgroundState.value.cardLocations[selectedUid]
          if (cardLocation) {
            // Move the card by the same delta
            cardLocation.x += moveX
            cardLocation.y += moveY

            // Update the draggable instance position
            const selectedInstance = draggableInstances.value.get(selectedUid)
            if (selectedInstance) {
              selectedInstance.position.x = cardLocation.x
              selectedInstance.position.y = cardLocation.y
            }
          }
        })
      }
    },
    onEnd: () => {
      // Save the text element if it was moved
      if (hasMoved) {
        saveTextElement()

        // If we've moved, mark this element as recently dragged
        recentlyDragged.value.add(uid)

        // If we've moved, don't automatically re-select this element
        if (selectedTextElements.value.includes(uid)) {
          selectedTextElements.value = selectedTextElements.value.filter((id) => id !== uid)

          // Update primary selected element if needed
          if (selectedTextElement.value === uid) {
            selectedTextElement.value = null
          }
        }

        // Add a delay before clearing the dragging flags to prevent immediate focus
        setTimeout(() => {
          isDragging.value = false
          isDraggingText.value = false

          // Clear the recently dragged flag after some time
          setTimeout(() => {
            recentlyDragged.value.delete(uid)
          }, 300)
        }, 50)
      } else {
        // If the element wasn't moved, it was a click, so focus the input
        isDragging.value = false
        isDraggingText.value = false

        // Wait a moment before applying focus to ensure click events are processed
        setTimeout(() => {
          // Only focus if we're not dragging anymore
          if (!isDragging.value && !isDraggingText.value) {
            const editableElement = textRef.querySelector('[contenteditable]') as HTMLDivElement | null
            if (editableElement) {
              editableElement.focus()

              // Move cursor to the end of the text
              if (textElement.text) {
                const range = document.createRange()
                const selection = window.getSelection()

                // First clear any existing selection
                selection?.removeAllRanges()

                // Set range to end of content
                if (editableElement.firstChild) {
                  range.setStart(editableElement.firstChild, textElement.text.length)
                  range.collapse(true)
                  selection?.addRange(range)
                }
              }
            }
          }
        }, 50)
      }
    },
  })

  // Store the instance
  draggableInstances.value.set(uid, instance)
  return instance.style.value
}

// Function to delete the selected text element
const deleteTextElement = () => {
  if (!selectedTextElement.value) return

  const uid = selectedTextElement.value

  // Remove the element from the textElements array
  textElements.value = textElements.value.filter((el) => el.uid !== uid)

  // Remove the draggable instance
  draggableInstances.value.delete(uid)

  // Remove font size record if exists
  if (textElementFontSizes.value[uid]) {
    delete textElementFontSizes.value[uid]
  }

  // Clear the selection
  selectedTextElement.value = null
  selectedTextElements.value = selectedTextElements.value.filter((id) => id !== uid)

  // Update the state to save the changes
  updateState()
}
</script>

<template>
  <div class="p-8">
    <deck-select v-model="selectedDeckId" class="w-max" />

    <div v-if="fetchCompleted" class="mt-8 h-full">
      <!-- Main playground area -->
      <div class="min-h-screen">
        <div class="h-full rounded-lg shadow-md">
          <div class="flex justify-between">
            <h1 class="mb-4 text-2xl font-bold">Playground</h1>

            <div class="flex items-center gap-2 text-xl">
              <button
                class="flex size-8 cursor-pointer items-center justify-center rounded-full border-1 border-gray-300 active:bg-gray-400"
                @click="resetCardPositions"
                title="Reset cards"
              >
                <span class="material-symbols-outlined text-sm"> refresh </span>
              </button>
              <button
                class="flex size-8 cursor-pointer items-center justify-center rounded-full border-1 border-gray-300"
                :class="{
                  'bg-blue-500': isSnappingEnabled,
                  'active:bg-gray-400': !isSnappingEnabled,
                }"
                @click="toggleSnapping"
                title="Toggle snapping"
              >
                <span class="material-symbols-outlined text-sm"> grid_on </span>
              </button>
              <button
                class="flex size-8 cursor-pointer items-center justify-center rounded-full border-1 border-gray-300 active:bg-gray-400"
                @click="changeCardSize(Math.max(50, playgroundState.cardSize - 50))"
                title="Decrease card size"
              >
                <span class="material-symbols-outlined text-xs"> remove </span>
              </button>
              <button
                class="flex size-8 cursor-pointer items-center justify-center rounded-full border-1 border-gray-300 active:bg-gray-400"
                @click="changeCardSize(Math.min(300, playgroundState.cardSize + 50))"
                title="Increase card size"
              >
                <span class="material-symbols-outlined text-xs"> add </span>
              </button>
              <button
                class="flex size-8 cursor-pointer items-center justify-center rounded-full border-1 border-gray-300 active:bg-gray-400"
                @click="addTextElement"
                title="Add text element"
              >
                <span class="material-symbols-outlined text-xs"> add_chart </span>
              </button>
              <!-- Text formatting buttons - only show when text element is selected -->
              <button
                v-if="selectedTextElement && !isDraggingText"
                class="flex size-8 cursor-pointer items-center justify-center rounded-full border-1 border-gray-300 active:bg-gray-400"
                @mousedown.prevent
                @click="decreaseTextSize"
                title="Decrease font size"
              >
                <span class="material-symbols-outlined text-xs"> text_decrease </span>
              </button>
              <button
                v-if="selectedTextElement && !isDraggingText"
                class="flex size-8 cursor-pointer items-center justify-center rounded-full border-1 border-gray-300 active:bg-gray-400"
                @mousedown.prevent
                @click="increaseTextSize"
                title="Increase font size"
              >
                <span class="material-symbols-outlined text-xs"> text_increase </span>
              </button>
              <!-- Delete text element button -->
              <button
                v-if="selectedTextElement && !isDraggingText"
                class="flex size-8 cursor-pointer items-center justify-center rounded-full border-1 border-red-300 text-red-500 hover:bg-red-100 active:bg-red-200"
                @mousedown.prevent
                @click="deleteTextElement"
                title="Delete text element"
              >
                <span class="material-symbols-outlined text-xs"> delete </span>
              </button>
            </div>
          </div>
          <div
            ref="container"
            :class="{ 'cursor-grabbing': isPanning }"
            class="relative h-screen overflow-hidden rounded-lg border border-gray-300"
            @mousedown="startSelection"
            @mousemove="updateSelection"
            @mouseup="endSelection"
            @mouseleave="endSelection"
            @contextmenu.prevent
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

            <template v-if="cardsOnField && cardsOnField.length > 0">
              <div
                v-for="element in textElements"
                :key="element.uid"
                :ref="(el) => textRefs.set(element.uid, el as HTMLElement)"
                :style="`${draggableInstances.get(element.uid)?.style || initTextDraggable(element.uid)}; position: absolute; cursor: move; z-index: ${element.z};`"
                class="text-element box-border border-2 border-transparent"
                :class="{
                  'border-yellow-200':
                    selectedTextElements.includes(element.uid) && !isDraggingText && !recentlyDragged.has(element.uid),
                }"
                @click="
                  (e) => {
                    if (!isDragging && !isDraggingText && !recentlyDragged.has(element.uid))
                      selectTextElement(element.uid, e)
                  }
                "
              >
                <div
                  contenteditable="true"
                  @input="
                    (e: Event) => {
                      element.text = (e.target as HTMLDivElement).innerText
                      saveTextElement()
                    }
                  "
                  @focus="!isDraggingText && selectTextElement(element.uid)"
                  @blur="selectedTextElement = null"
                  :style="`font-size: ${getScaledFontSize(element.uid)}px;`"
                  class="pointer-events-auto inline-block min-w-[1em] bg-transparent p-1 whitespace-nowrap outline-none"
                >
                  {{ element.text }}
                </div>
              </div>

              <div
                v-for="(card, index) in cardsOnField"
                :key="card.uid"
                :ref="(el) => cardRefs.set(card.uid, el as HTMLElement)"
                :style="`${draggableInstances.get(card.uid)?.style || initDraggable(card.uid, index)}; z-index: ${
                  playgroundState.cardLocations[card.uid]?.z || index + 1
                }`"
                class="card-element absolute box-border w-max cursor-move border-2 border-transparent"
                :class="{
                  'border-yellow-200': selectedCards.includes(card.uid),
                }"
                @click="toggleCardSelection(card.uid, $event)"
                @click.right.prevent="inspectedCard = card"
              >
                <img
                  :src="
                    card.card_images && card.card_images.length > 0 ? card.card_images[0].image_url : getS3ImageUrl(0)
                  "
                  :style="`width: ${displayCardSize}px`"
                  :alt="card.name"
                  class="select-none"
                />
                <!-- Snap edge indicators as absolutely positioned divs -->
                <div
                  v-if="snapHighlightedEdges.edges[card.uid]?.top"
                  class="absolute top-0 right-0 left-0 z-[1000] h-1 bg-white"
                ></div>
                <div
                  v-if="snapHighlightedEdges.edges[card.uid]?.right"
                  class="absolute top-0 right-0 bottom-0 z-[1000] w-1 bg-white"
                ></div>
                <div
                  v-if="snapHighlightedEdges.edges[card.uid]?.bottom"
                  class="absolute right-0 bottom-0 left-0 z-[1000] h-1 bg-white"
                ></div>
                <div
                  v-if="snapHighlightedEdges.edges[card.uid]?.left"
                  class="absolute top-0 bottom-0 left-0 z-[1000] w-1 bg-white"
                ></div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
  <inspect-modal v-if="inspectedCard" :cards="inspectedCard" @close="inspectedCard = null" />
</template>
