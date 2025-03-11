<script setup lang="ts">
import FieldSide from '@/components/FieldSide.vue'
import { db } from '@/firebase/client'
import { useDeckStore } from '@/stores/deck'
import { useUserStore } from '@/stores/user'
import type { GameState, YugiohCard } from '@/types'
import { useClipboard } from '@vueuse/core'
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
import { debounce } from 'lodash'
import { storeToRefs } from 'pinia'
import type { ComputedRef, Ref } from 'vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

/*
TODO:
-- MUST HAVES --
- Tokens
- Attach cards

-- NICE TO HAVES --
- speed up deck/card add
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
const route = useRoute()

// Fetch all Yu-Gi-Oh! cards and decks on component mount
onMounted(async () => {
  getAllCards()
  getDecks()
  if (route.params.gameCode) {
    gameCode.value = Number(route.params.gameCode)
    await joinGame()
  }
})

const gameId: Ref<string | undefined> = ref()
const gameCode: Ref<number | undefined> = ref()
const gameState = ref<GameState>(defaultGameState)
const deckId: Ref<string | undefined> = ref()
let unsubscribe: () => void
const joinUrl = computed(() => `${window.location.origin}/play/${gameCode.value}`)
const { copy } = useClipboard({ source: joinUrl.value })

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

const leaveGame = () => {
  gameId.value = undefined
  gameCode.value = undefined
  gameState.value = defaultGameState
  deckId.value = undefined
  unsubscribe()
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

const updateGame = debounce(async () => {
  if (!gameId.value) return
  await updateDoc(doc(db, 'games', gameId.value), gameState.value)
}, 500)

const joinGame = async () => {
  const q = query(collection(db, 'games'), where('code', '==', Number(gameCode.value)))
  const querySnapshot = await getDocs(q)
  if (querySnapshot.docs.length > 0) {
    gameId.value = querySnapshot.docs[0].id
    const gameData = querySnapshot.docs[0].data() as GameState
    if (gameData.player1?.id === userStore.user?.id) {
      deckId.value = gameData.deck1 ?? undefined
    } else if (gameData.player2?.id === userStore.user?.id) {
      deckId.value = gameData.deck2 ?? undefined
    } else if (!gameData.player2) {
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
  unsubscribe = onSnapshot(doc(db, 'games', gameId.value), (doc) => {
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
  <!-- JOIN/CREATE GAME -->
  <div v-if="!gameId" class="m-auto flex w-max flex-col items-center">
    <div>
      <input v-model="gameCode" class="mt-2 mr-2 rounded-md border-1 border-gray-300 p-2" />
      <button
        @click="joinGame"
        class="cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
      >
        Join Game
      </button>
    </div>
    <p class="m-4">or</p>
    <button
      @click="createGame"
      class="cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
    >
      Create Game
    </button>
  </div>

  <!-- ROOM?LEAVE -->
  <div v-else class="m-auto w-fit text-center">
    <p class="text-lg">
      Room code: <span class="text-lg font-bold">{{ gameCode }}</span>
    </p>
    <button
      @click="leaveGame"
      class="mt-4 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
    >
      Leave Game
    </button>
    <button
      @click="copy(joinUrl)"
      class="mt-4 ml-4 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
    >
      Copy Link
    </button>
  </div>

  <!-- PICK DECK -->
  <div
    v-if="gameId && !gameState[deckKey]"
    class="m-4 flex w-min min-w-80 flex-col items-start rounded-md border-1 border-gray-300 p-4 active:bg-gray-600"
  >
    <h3 class="text-2xl">Pick your deck</h3>
    <div class="mt-2 flex max-w-full flex-wrap gap-2" v-if="decks.length">
      <div
        v-for="deck in decks"
        :key="deck.id"
        class="flex max-w-full cursor-pointer items-center rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
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
  <div v-if="gameId && (deckId || player === null)" class="m-8">
    <!-- OPPONENT -->
    <field-side
      v-if="gameId"
      v-model="gameState"
      :deck="deck === 'cards2' ? 'cards1' : 'cards2'"
      :viewer="player === null"
      @update="updateGame"
      class="mb-2 rotate-180"
    />
    <!-- PLAYER -->
    <field-side
      v-if="gameId"
      v-model="gameState"
      :deck="deck ?? 'cards1'"
      :interactive="player !== null"
      :viewer="player === null"
      @update="updateGame"
    />
  </div>
</template>
