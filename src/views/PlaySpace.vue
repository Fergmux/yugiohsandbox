<script setup lang="ts">
import FieldSide from '@/components/FieldSide.vue'
import { db } from '@/firebase/client'
import { useDeckStore } from '@/stores/deck'
import { useUserStore } from '@/stores/user'
import type { GameState, YugiohCard } from '@/types'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { storeToRefs } from 'pinia'
import type { ComputedRef, Ref } from 'vue'
import { computed, onMounted, ref } from 'vue'

/*
TODO:
- Counters
- Tokens
- Show to opponent
- Give to opponent
- Attach cards
- localstorage username
*/

const extraDeckTypes = [
  'Fusion Monster',
  'Link Monster',
  'Pendulum Effect Fusion Monster',
  'Synchro Monster',
  'Synchro Pendulum Effect Monster',
  'Synchro Tuner Monster',
  'XYZ Monster',
  'XYZ Pendulum Effect Monster',
]

const defaultGameState: GameState = {
  code: null,
  player1: null,
  player2: null,
  deck1: null,
  deck2: null,
  cards1: {
    deck: [],
    hand: [],
    field: Array(11).fill(null),
    graveyard: [],
    banished: [],
    extra: [],
    zones: Array(2).fill(null),
  },
  cards2: {
    deck: [],
    hand: [],
    field: Array(11).fill(null),
    graveyard: [],
    banished: [],
    extra: [],
    zones: Array(2).fill(null),
  },
}
const deckStore = useDeckStore()
const { decks, allCards } = storeToRefs(deckStore)
const { getAllCards, getDecks } = deckStore
const userStore = useUserStore()
// Fetch all Yu-Gi-Oh! cards and decks on component mount
onMounted(async () => {
  getAllCards()
  getDecks()
})

const gameId: Ref<string | undefined> = ref()
const gameCode: Ref<number | undefined> = ref()
const gameState = ref<GameState>(defaultGameState)
const deckId: Ref<string | undefined> = ref()

const createGame = async () => {
  gameState.value = defaultGameState
  gameCode.value = Math.floor(Math.random() * 10001) // Random number between 0 and 10000
  gameState.value.code = gameCode.value
  gameState.value.player1 = userStore.user ?? null
  try {
    const docRef = await addDoc(collection(db, 'games'), gameState.value)
    console.log('Document written with ID: ', docRef.id)
    gameId.value = docRef.id
  } catch (e) {
    console.error('Error adding document: ', e)
  }
  subscribe()
}

const cardsInDeck: ComputedRef<YugiohCard[]> = computed(() => {
  return decks.value
    .find((deck) => deck.id === deckId.value)
    ?.cards.map((cardId: number) => allCards.value.find((card) => card.id === cardId))
    .filter(Boolean) as YugiohCard[]
})

const cardsInNormalDeck = computed(() =>
  cardsInDeck.value
    .filter((card) => !extraDeckTypes.includes(card.type))
    .map((card) => ({
      ...card,
      faceDown: true,
    })),
)
const cardsInExtraDeck = computed(() =>
  cardsInDeck.value
    .filter((card) => extraDeckTypes.includes(card.type))
    .map((card) => ({
      ...card,
      faceDown: true,
    })),
)

const setDeck = (id: string) => {
  if (!player.value) return
  deckId.value = id
  gameState.value[deck.value].deck = cardsInNormalDeck.value.sort(() => Math.random() - 0.5)
  gameState.value[deck.value].extra = cardsInExtraDeck.value
  gameState.value[deckKey.value] = id
  updateGame()
}

const updateGame = async () => {
  if (!gameId.value) return
  await updateDoc(doc(db, 'games', gameId.value), gameState.value)
}

const joinGame = async () => {
  const q = query(collection(db, 'games'), where('code', '==', Number(gameCode.value)))
  const querySnapshot = await getDocs(q)
  if (querySnapshot.docs.length > 0) {
    gameId.value = querySnapshot.docs[0].id
    const gameData = querySnapshot.docs[0].data() as GameState
    if (!gameData.player2) {
      gameData.player2 = userStore.user ?? null
      await updateDoc(doc(db, 'games', gameId.value), { ...gameData })
    }
    subscribe()
  } else {
    console.error('Game not found')
  }
}

const subscribe = () => {
  if (!gameId.value) return
  onSnapshot(doc(db, 'games', gameId.value), (doc) => {
    console.log('Current data: ', doc.data())
    gameState.value = doc.data() as GameState
  })
}

const player = computed(() => {
  if (gameState.value.player1?.id === userStore.user?.id) {
    return 'player1'
  } else if (gameState.value.player2?.id === userStore.user?.id) {
    return 'player2'
  }
  return null
})
const deck: ComputedRef<'cards1' | 'cards2'> = computed(() =>
  player.value === 'player2' ? 'cards2' : 'cards1',
)
const deckKey = computed(() => (player.value === 'player1' ? 'deck1' : 'deck2'))
</script>
<template>
  <div v-if="!gameId" class="m-4">
    <button @click="createGame" class="rounded-md border-1 border-gray-300 p-2">Create Game</button>
    <br />
    <input v-model="gameCode" class="mt-2 mr-2 rounded-md border-1 border-gray-300 p-2" />
    <button @click="joinGame" class="rounded-md border-1 border-gray-300 p-2">Join Game</button>
  </div>
  <p v-else class="m-v m-auto w-fit text-lg">Room code: {{ gameCode }}</p>
  <div
    v-if="gameId && !gameState[deckKey]"
    class="m-4 flex w-min min-w-80 flex-col items-start rounded-md border-1 border-gray-300 p-4"
  >
    <h3 class="text-2xl">Pick your deck</h3>
    <div class="mt-2 flex max-w-full flex-wrap gap-2" v-if="decks.length">
      <div
        v-for="deck in decks"
        :key="deck.id"
        class="flex max-w-full cursor-pointer items-center rounded-md border-1 border-gray-300 p-2"
      >
        <button class="max-w-full min-w-0 cursor-pointer" @click="setDeck(deck.id)">
          <h4 class="overflow-hidden text-xl font-semibold overflow-ellipsis">
            {{ deck.name }}
          </h4>
        </button>
      </div>
    </div>
    <p v-else>No decks yet</p>
  </div>
  <!-- WHOLE PLAYSPACE -->
  <div class="m-8">
    <!-- OPPONENT -->
    <field-side
      v-if="gameId"
      v-model="gameState"
      :deck="deck === 'cards2' ? 'cards1' : 'cards2'"
      @update="updateGame"
      class="mb-2 rotate-180"
    />
    <!-- PLAYER -->
    <field-side
      v-if="gameId"
      v-model="gameState"
      :deck="deck ?? 'cards1'"
      :interactive="player !== null"
      @update="updateGame"
    />
  </div>
</template>
