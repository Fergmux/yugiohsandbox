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
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import type { ComputedRef, Ref } from 'vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
/*
TODO:
PLAYSPACE

-- MUST HAVES --
- Attach cards

-- NICE TO HAVES --
- Textbox for atk/def
- min w on whole container (responsive breaks)
- Turns?
- Coin flip?

DECK BUILDER
- order deck builder card list by type
- Filter search
- Tags
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
  players: {
    player1: null,
    player2: null,
  },
  decks: {
    player1: null,
    player2: null,
  },
  lifePoints: {
    player1: 8000,
    player2: 8000,
  },
  cards: {
    player1: {
      deck: [],
      hand: [],
      field: Array(11).fill(null),
      graveyard: [],
      banished: [],
      extra: [],
      zones: Array(2).fill(null),
      tokens: [],
      attached: [],
    },
    player2: {
      deck: [],
      hand: [],
      field: Array(11).fill(null),
      graveyard: [],
      banished: [],
      extra: [],
      zones: Array(2).fill(null),
      tokens: [],
      attached: [],
    },
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
  gameState.value.players.player1 = userStore.user ?? null
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
    ?.cards.map((cardId: number) => {
      const card = allCards.value.find((card) => card.id === cardId)
      if (card) {
        return { ...card, uid: uuidv4() }
      }
      return undefined
    })
    .filter(Boolean) as YugiohCard[]
})

const cardsInNormalDeck = computed(() =>
  cardsInDeck.value
    .filter((card) => !extraDeckTypes.includes(card.type) && card.type !== 'Token')
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

const tokensInDeck = computed(() => {
  return cardsInDeck.value
    .filter((card) => card.type === 'Token')
    .map((card) => ({
      ...card,
      faceDown: true,
    }))
})

const setDeck = (id: string) => {
  deckId.value = id
  gameState.value.cards[playerKey.value].deck = cardsInNormalDeck.value.sort(
    () => Math.random() - 0.5,
  )
  gameState.value.cards[playerKey.value].tokens = tokensInDeck.value
  gameState.value.cards[playerKey.value].extra = cardsInExtraDeck.value
  gameState.value.decks[playerKey.value] = id
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
    if (gameData.players.player1?.id === userStore.user?.id) {
      deckId.value = gameData.decks.player1 ?? undefined
    } else if (gameData.players.player2?.id === userStore.user?.id) {
      deckId.value = gameData.decks.player2 ?? undefined
    } else if (!gameData.players.player2) {
      gameData.players.player2 = userStore.user ?? null
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
  if (gameState.value.players.player1?.id === userStore.user?.id) {
    return 'player1'
  } else if (gameState.value.players.player2?.id === userStore.user?.id) {
    return 'player2'
  }
  return null
})
const playerKey: ComputedRef<'player1' | 'player2'> = computed(() =>
  player.value === 'player2' ? 'player2' : 'player1',
)
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
    v-if="gameId && !gameState.decks[playerKey]"
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
  <div
    v-if="gameId && (deckId || player === null)"
    class="mx-auto my-8 max-h-[min(90vw,90vh)] max-w-[min(90vw,90vh)]"
  >
    <!-- OPPONENT -->
    <field-side
      v-if="gameId"
      v-model="gameState"
      :player="playerKey === 'player2' ? 'player1' : 'player2'"
      :viewer="player === null"
      @update="updateGame"
      class="mb-2 rotate-180"
    />
    <!-- PLAYER -->
    <field-side
      v-if="gameId"
      v-model="gameState"
      :player="playerKey"
      :interactive="player !== null"
      :viewer="player === null"
      @update="updateGame"
    />
  </div>
</template>
