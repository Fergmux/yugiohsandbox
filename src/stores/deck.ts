import type { Ref } from 'vue'
import { computed, ref } from 'vue'

import { defineStore } from 'pinia'

import type { Deck } from '@/types/deck'
import type { YugiohCard } from '@/types/yugiohCard'

import { useUserStore } from './user'

export const useDeckStore = defineStore('deck', () => {
  const userStore = useUserStore()
  const allCards: Ref<YugiohCard[]> = ref([])
  const decks: Ref<Deck[]> = ref([])
  const addingDeck = ref(false)
  const deletingDeck: Ref<boolean> = ref(false)
  const decksLoading = ref(false)
  const selectedDeckId: Ref<string | undefined> = ref(undefined)
  const selectedDeck = computed(() => decks.value.find((deck) => deck.id === selectedDeckId.value))

  const getAllCards = async () => {
    if (allCards.value.length > 0) return
    try {
      const response = await fetch(import.meta.env.VITE_YUGIOH_API_URL + '?misc=yes')
      const data = await response.json()
      allCards.value = data.data // API returns data in "data"
    } catch (error) {
      console.error('Error fetching card data:', error)
    }
  }

  const addDeck = async (deckName: string): Promise<string> => {
    addingDeck.value = true
    const response = await fetch(`/.netlify/functions/add-deck`, {
      method: 'POST',
      body: JSON.stringify({ userId: userStore.user?.id, deckName: deckName }),
    })
    await getDecks()
    const deck = await response.json()
    addingDeck.value = false
    return deck.id
  }

  const ensureDecks = async () => {
    if (decks.value.length > 0) return
    await getDecks()
  }

  const getDecks = async () => {
    decksLoading.value = true
    const response = await fetch(`/.netlify/functions/get-decks/${userStore.user?.id}`)
    const deckData: Deck[] = await response.json()
    decks.value = deckData
    decksLoading.value = false
  }

  const removeDeck = async () => {
    if (!selectedDeckId.value) return
    deletingDeck.value = true
    await fetch(`/.netlify/functions/remove-deck`, {
      method: 'POST',
      body: JSON.stringify({ deckId: selectedDeckId.value }),
    })
    await getDecks()
    deletingDeck.value = false
  }

  const addCardToDeck = async (cardId: number) => {
    if (selectedDeck.value) {
      selectedDeck.value.cards.push(cardId)
      fetch(`/.netlify/functions/add-card-to-deck`, {
        method: 'POST',
        body: JSON.stringify({ deckId: selectedDeckId.value, cards: selectedDeck.value.cards }),
      })
    }
  }

  const removeCardFromDeck = async (cardId: number) => {
    if (selectedDeck.value) {
      selectedDeck.value.cards.splice(selectedDeck.value.cards.indexOf(cardId), 1)
      fetch(`/.netlify/functions/remove-card-from-deck`, {
        method: 'POST',
        body: JSON.stringify({ deckId: selectedDeckId.value, cards: selectedDeck.value.cards }),
      })
    }
  }

  const changeDeckName = async (name: string) => {
    if (selectedDeck.value) {
      selectedDeck.value.name = name
      fetch(`/.netlify/functions/edit-deck-name`, {
        method: 'POST',
        body: JSON.stringify({ deckId: selectedDeckId.value, name }),
      })
    }
  }

  const shareDeck = async (username: string) => {
    if (selectedDeck.value) {
      fetch(`/.netlify/functions/share-deck`, {
        method: 'POST',
        body: JSON.stringify({
          deckId: selectedDeckId.value,
          targetUsername: username,
          username: userStore.user?.username,
        }),
      })
    }
  }

  const copyDeck = async (newDeckName: string): Promise<void> => {
    if (!selectedDeck.value) return

    // Create a new deck with the new name
    const newDeckId = await addDeck(newDeckName)

    // Copy all cards from the selected deck to the new deck
    if (selectedDeck.value.cards.length > 0) {
      await fetch(`/.netlify/functions/add-card-to-deck`, {
        method: 'POST',
        body: JSON.stringify({ deckId: newDeckId, cards: [...selectedDeck.value.cards] }),
      })
    }

    // Refetch decks to ensure we have the latest data
    await getDecks()
  }

  return {
    getAllCards,
    addDeck,
    getDecks,
    ensureDecks,
    removeDeck,
    addCardToDeck,
    removeCardFromDeck,
    changeDeckName,
    shareDeck,
    copyDeck,
    allCards,
    decks,
    addingDeck,
    deletingDeck,
    decksLoading,
    selectedDeckId,
    selectedDeck,
  }
})
