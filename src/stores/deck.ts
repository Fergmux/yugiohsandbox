import type { Deck, YugiohCard } from '@/types'
import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { useUserStore } from './user'

export const useDeckStore = defineStore('deck', () => {
  const userStore = useUserStore()
  const allCards: Ref<YugiohCard[]> = ref([])
  const decks: Ref<Deck[]> = ref([])
  const addingDeck = ref(false)
  const deletingDeck: Ref<string | null> = ref(null)

  const getAllCards = async () => {
    if (allCards.value.length > 0) return
    try {
      const response = await fetch(import.meta.env.VITE_YUGIOH_API_URL)
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

  const getDecks = async () => {
    const response = await fetch(`/.netlify/functions/get-decks/${userStore.user?.id}`)
    const deckData: Deck[] = await response.json()
    decks.value = deckData
  }

  const removeDeck = async (deckId: string) => {
    deletingDeck.value = deckId
    await fetch(`/.netlify/functions/remove-deck`, {
      method: 'POST',
      body: JSON.stringify({ deckId }),
    })
    await getDecks()
    deletingDeck.value = null
  }

  const addCardToDeck = async (deckId: string, cardId: number) => {
    const deck = decks.value.find((deck) => deck.id === deckId)
    if (deck) {
      deck.cards.push(cardId)
      fetch(`/.netlify/functions/add-card-to-deck`, {
        method: 'POST',
        body: JSON.stringify({ deckId, cards: deck.cards }),
      })
    }
  }

  const removeCardFromDeck = async (deckId: string, cardId: number) => {
    const deck = decks.value.find((deck) => deck.id === deckId)
    if (deck) {
      deck.cards.splice(deck.cards.indexOf(cardId), 1)
      fetch(`/.netlify/functions/remove-card-from-deck`, {
        method: 'POST',
        body: JSON.stringify({ deckId, cards: deck.cards }),
      })
    }
  }

  return {
    getAllCards,
    addDeck,
    getDecks,
    removeDeck,
    addCardToDeck,
    removeCardFromDeck,
    allCards,
    decks,
    addingDeck,
    deletingDeck,
  }
})
