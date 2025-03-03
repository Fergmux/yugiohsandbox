<script setup lang="ts">
import type { ComputedRef, Ref } from 'vue'
import { computed, onMounted, ref, watchEffect } from 'vue'

// API & S3 Bucket URLs
const API_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php'
const S3_BUCKET_URL = 'https://yugioh-simulator.s3.amazonaws.com/yugioh_cards/'

const userName = ref('')
const user: Ref<User | undefined> = ref()
async function addUser() {
  try {
    const response = await fetch(`/.netlify/functions/add-user`, {
      method: 'POST',
      body: JSON.stringify({ username: userName.value }),
    })
    const userData: User = await response.json()
    console.log(userData)
    user.value = userData

    if (!response.ok) throw new Error('User not found')
  } catch (err) {
    // error.value = err.message;
    console.log(err)
  }
}

const getUser = async () => {
  const response = await fetch(`/.netlify/functions/get-user/${userName.value}`)
  const userData: User = await response.json()
  console.log(userData)
  user.value = userData
  await getDecks()
}

const deckName = ref('')
const decks: Ref<Deck[]> = ref([])
const addDeck = async () => {
  if (!user.value) return
  const response = await fetch(`/.netlify/functions/add-deck`, {
    method: 'POST',
    body: JSON.stringify({ userId: user.value.id, deckName: deckName.value }),
  })
  const deckData: Deck = await response.json()
  console.log(deckData)
  getDecks()
}

const getDecks = async () => {
  const response = await fetch(`/.netlify/functions/get-decks/${user.value?.id}`)
  const deckData: Deck[] = await response.json()
  console.log(deckData)
  decks.value = deckData
}

const removeDeck = async (deckId: string) => {
  const response = await fetch(`/.netlify/functions/remove-deck`, {
    method: 'POST',
    body: JSON.stringify({ deckId }),
  })
  const deckData = await response.json()
  console.log(deckData)
  getDecks()
}

const addCardToDeck = async () => {
  const response = await fetch(`/.netlify/functions/add-card-to-deck`, {
    method: 'POST',
    body: JSON.stringify({ cardId: selectedCard.value?.id, deckId: activeDeckId.value }),
  })
  const cardData = await response.json()
  console.log(cardData)
  getDecks()
}

const removeCardFromDeck = async (cardId: number) => {
  const response = await fetch(`/.netlify/functions/remove-card-from-deck`, {
    method: 'POST',
    body: JSON.stringify({ cardId, deckId: activeDeckId.value }),
  })
  const cardData = await response.json()
  console.log(cardData)
  getDecks()
}

const activeDeckId = ref<string | null>(null)
const setActiveDeck = (deckId: string) => {
  activeDeckId.value = deckId
  // getDeckCards()
}

const activeDeck = computed(() => {
  return decks.value.find((deck) => deck.id === activeDeckId.value)
})

const deckCards: ComputedRef<YugiohCard[]> = computed(() => {
  return activeDeck.value?.cards
    .map((cardId) => allCards.value.find((card) => card.id === cardId))
    .filter(Boolean) as YugiohCard[]
})

// Type definitions for Yu-Gi-Oh! cards
interface CardImage {
  image_url: string
}

interface YugiohCard {
  id: number
  name: string
  desc: string
  type: string
  card_images: CardImage[]
}

interface Deck {
  id: string
  name: string
  cards: number[]
}

interface User {
  id: string
  username: string
}

// Reactive variables
const allCards = ref<YugiohCard[]>([]) // Store all cards
const searchQuery = ref<string>('') // User input for search
const selectedCard = ref<YugiohCard | null>(null) // Selected card details

// Fetch all Yu-Gi-Oh! cards on component mount
onMounted(async () => {
  try {
    const response = await fetch(API_URL)
    const data = await response.json()
    allCards.value = data.data // API returns data in "data"
  } catch (error) {
    console.error('Error fetching card data:', error)
  }
})

// Computed property for autocomplete filtering
const filteredCards = computed<YugiohCard[]>(() => {
  if (!searchQuery.value) return []
  return allCards.value
    .filter((card) => card.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
    .slice(0, 10) // Limit suggestions to 10
})

const searchCard: ComputedRef<YugiohCard | undefined> = computed(() => {
  return allCards.value.find((card) => card.name.toLowerCase() === searchQuery.value.toLowerCase())
})

watchEffect(() => {
  if (searchCard.value) {
    selectCard(searchCard.value)
  }
})

// Fetch specific card details
// const fetchCardDetails = async (cardName: string) => {
//   try {
//     const response = await fetch(`${API_URL}?name=${encodeURIComponent(cardName)}`)
//     const data = await response.json()
//     selectCard(data.data[0]) // Take the first match
//   } catch (error) {
//     console.error('Error fetching card details:', error)
//   }
// }

const selectCard = (card: YugiohCard) => {
  selectedCard.value = card
}

// Construct image URL from S3 bucket using card ID
const getS3ImageUrl = (cardId: number): string => {
  return `${S3_BUCKET_URL}${cardId}.jpg`
}
</script>

<template>
  <div>
    <!-- Autocomplete Search Box -->
    <input type="text" v-model="userName" placeholder="User name" />
    <button @click="addUser">Add User</button>
    <button @click="getUser">Get User</button>
    <br />
    <input type="text" v-model="deckName" placeholder="Deck name" />
    <button @click="addDeck">Add Deck</button>
    <h4>User: {{ user?.username }}</h4>
    <h3>Decks</h3>
    <ul>
      <li v-for="deck in decks" :key="deck.id">
        <button @click="setActiveDeck(deck.id)">
          <h4>{{ deck.name }}</h4>
        </button>
        <button @click="removeDeck(deck.id)">X</button>
      </li>
    </ul>
    <br />
    <h2>Deck: {{ activeDeck?.name }}</h2>
    <h3>Cards</h3>
    <ul>
      <li v-for="card in deckCards" :key="card.id">
        <button @click="selectCard(card)">{{ card.name }}</button>
        <button @click="removeCardFromDeck(card.id)">X</button>
      </li>
    </ul>

    <input type="text" v-model="searchQuery" placeholder="Search for a card..." />

    <!-- Autocomplete Suggestions -->
    <ul v-if="filteredCards.length">
      <li
        v-for="card in filteredCards"
        :key="card.id"
        @click="searchQuery = card.name"
        style="cursor: pointer"
      >
        {{ card.name }}
      </li>
    </ul>

    <br />
    <!-- Add to Deck Button -->
    <button v-if="selectedCard" @click="addCardToDeck" class="add-to-deck-btn">Add to Deck</button>

    <!-- Display Selected Card Details -->
    <div v-if="selectedCard">
      <h2>{{ selectedCard.name }}</h2>
      <img width="400" :src="getS3ImageUrl(selectedCard.id)" :alt="selectedCard.name" />
      <p><strong>Type:</strong> {{ selectedCard.type }}</p>
      <p>{{ selectedCard.desc }}</p>
    </div>
  </div>
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;

    padding: 1rem 0;
    margin-top: 1rem;
  }
}
</style>
