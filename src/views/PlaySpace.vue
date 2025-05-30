<script setup lang="ts">
import type { ComputedRef, Ref } from 'vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { addDoc, collection, doc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { debounce } from 'lodash'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { useRoute } from 'vue-router'

import CoinFlip from '@/components/play-space/CoinFlip.vue'
import FieldSide from '@/components/play-space/FieldSide.vue'
import { db } from '@/firebase/client'
import { useDeckStore } from '@/stores/deck'
import { useUserStore } from '@/stores/user'
import { extraDeckTypes } from '@/types/filters'
import type { GameState, YugiohCard } from '@/types/yugiohCard'
import { useClipboard } from '@vueuse/core'

/*
TODO:
- button component
- align login page with join game page








PLAYSPACE
New Features
- Spectator count
- text search deck
- Player name indicators
- Login password/username
- Admin portal?
- User profile page?
- Ensure mobile works?
- move from fauna to firebase
- put firebase into edge functions
- Attack calculator
- missing image backup


- Dice
- Search deck by name
- highlight card (for opponent)?
- Counters in other card locations?
- Multi select????????
- custom card?
- Edit level
- Edit attribute
- refactor field side


Deck Builder
- Tags
- Format validation?
- improved card details
- reset search result length
- card size screen width
- level atk set exclude none
- copy deck

Playground
- remove deleted cards
- Draw square/line?
- Text box!
- Click for options?
- bring to front/back?
- Copy card?
- delete card?
- Align left/right/top/bottom?
- Rotate left/right?
*/

const turnNameMap = ['Draw', 'Standby', 'Main 1', 'Battle', 'Main 2', 'End']

const defaultGameState: GameState = {
  code: null,
  coinFlip: null,
  turn: 0,
  gameLog: [],
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

const inputRef = ref<HTMLInputElement>()
// Fetch all Yu-Gi-Oh! cards and decks on component mount
onMounted(async () => {
  inputRef.value?.focus()
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

type CoinFlipComponent = {
  flip: (desiredSide?: 'heads' | 'tails') => void
}

const coinRef = ref<CoinFlipComponent | null>(null)
const flipCoin = (result: 'heads' | 'tails') => {
  const count = gameState.value.coinFlip?.[1] ?? 0
  gameState.value.coinFlip = [result, count + 1]
  log(`flipped a coin`)
  updateGame()
}
watch(
  () => gameState.value.coinFlip,
  (coinFlip, oldCoinFlip) => {
    if (coinFlip && oldCoinFlip && coinFlip[1] !== oldCoinFlip[1]) {
      coinRef.value?.flip(coinFlip[0])
    }
  },
)

const log = (action: string) => {
  const text = `${userStore.user?.username} ${action}`
  gameState.value.gameLog.push({ text, timestamp: new Date().getTime() })
  updateGame()
}

const logRef = ref<HTMLDivElement | null>(null)
const textChat = ref('')
const showChat = ref(false)
const sendChat = () => {
  if (!textChat.value) return
  log(`: ${textChat.value}`)
  textChat.value = ''
}
const turn = computed(() => gameState.value.turn)
const setTurn = (turn: number) => {
  gameState.value.turn = turn
  log(`set turn to ${turnNameMap[turn % 6]}`)
  updateGame()
}
// Handle spacebar press to increment turn
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.code === 'Space' && gameId.value) {
    const newTurn = (turn.value + 1) % 12
    setTurn(newTurn)
  }
}

// Add event listener when component is mounted
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

// Remove event listener when component is unmounted
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

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
  gameState.value.cards[playerKey.value].deck = cardsInNormalDeck.value.sort(() => Math.random() - 0.5)
  gameState.value.cards[playerKey.value].tokens = tokensInDeck.value
  gameState.value.cards[playerKey.value].extra = cardsInExtraDeck.value
  gameState.value.decks[playerKey.value] = id
  updateGame()
}

const updateGame = debounce(async () => {
  if (!gameId.value) return
  await updateDoc(doc(db, 'games', gameId.value), gameState.value)
}, 100)

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
    gameState.value = doc.data() as GameState
    logRef.value?.scrollTo({ top: logRef.value.scrollHeight, behavior: 'smooth' })
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
const notesRef = ref<HTMLTextAreaElement | null>(null)
const showNotes = ref(false)
</script>
<template>
  <div v-if="gameId && (deckId || player === null)" class="fixed right-0 bottom-0 z-[200]">
    <div class="flex cursor-pointer justify-between bg-[rgba(0,0,0,0.5)]" @click="showNotes = !showNotes">
      <h3 class="text-xl">Notes</h3>
      <span class="material-symbols-outlined">{{ showNotes ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
    </div>
    <textarea
      ref="notesRef"
      class="w-[min(30vw,30vh)] bg-neutral-800 align-top"
      :class="{ 'h-[min(20vw,20vh)]': showNotes, 'h-[min(5vw,5vh)]': !showNotes }"
      @keydown.stop
      @keyup.stop.escape="notesRef?.blur()"
    />
  </div>
  <div
    v-if="gameId && (deckId || player === null)"
    class="fixed bottom-0 left-0 z-[200] max-w-[min(30vw,30vh)] bg-[rgba(0,0,0,0.5)]"
  >
    <div class="flex cursor-pointer justify-between" @click="showChat = !showChat">
      <h3 class="text-xl">Game Log</h3>
      <span class="material-symbols-outlined">{{ showChat ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
    </div>
    <div>
      <div
        ref="logRef"
        class="w-[min(30vw,30vh)] overflow-y-scroll"
        :class="{ 'h-[min(20vw,20vh)]': showChat, 'h-[min(5vw,5vh)]': !showChat }"
      >
        <p
          v-for="(log, index) in gameState.gameLog"
          :key="log.timestamp"
          :class="{ 'bg-neutral-800': index % 2 === 0 }"
          class="px-2 py-px"
        >
          {{ log.text }}
        </p>
      </div>
      <div v-if="showChat" class="flex">
        <input
          v-model="textChat"
          @keyup.enter="sendChat"
          @keydown.space.stop
          class="m-1 w-4/5 basis-4/5 rounded-md border-1 border-gray-300 p-1"
        />
        <button @click="sendChat" class="m-1 basis-8 rounded-md border-1 border-gray-300 p-1">Send</button>
      </div>
    </div>
  </div>
  <!-- JOIN/CREATE GAME -->
  <div v-if="!gameId" class="m-auto flex w-max flex-col items-center">
    <div>
      <input
        v-model="gameCode"
        ref="inputRef"
        class="mt-2 mr-2 rounded-md border-1 border-gray-300 p-2"
        @keyup.enter="joinGame"
      />
      <button @click="joinGame" class="cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600">
        Join Game
      </button>
    </div>
    <p class="m-4">or</p>
    <button @click="createGame" class="cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600">
      Create Game
    </button>
  </div>

  <!-- ROOM LEAVE -->
  <div v-else class="m-auto w-fit text-center">
    <p class="text-lg">
      Room code: <span class="text-lg font-bold">{{ gameCode }}</span>
    </p>
    <button @click="leaveGame" class="mt-4 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600">
      Leave Game
    </button>
    <button
      @click="copy(joinUrl)"
      class="mt-4 ml-4 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
    >
      Copy Link
    </button>

    <br />
    <coin-flip ref="coinRef" class="mx-auto mt-2" @flip="flipCoin" />
  </div>

  <!-- PICK DECK -->
  <div
    v-if="gameId && !gameState.decks[playerKey]"
    class="m-4 mx-auto mt-8 flex w-max min-w-80 flex-col items-start rounded-md border-1 border-gray-300 p-4 active:bg-gray-600"
  >
    <h3 class="mx-auto text-2xl">Pick your deck</h3>
    <div class="mt-4 flex max-w-full flex-wrap gap-2" v-if="decks.length">
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
  <div v-if="gameId && (deckId || player === null)" class="mt-20 flex h-screen items-center justify-center gap-2">
    <div class="flex flex-col gap-2 text-[min(1vh,1vw)] font-bold text-white">
      <p class="cursor-pointer" :class="{ 'bg-yellow-500': turn < 6 }" @click="gameState.turn = 0">
        {{ playerKey === 'player2' ? 'Your turn' : "Opponent's turn" }}
      </p>
      <div class="cursor-pointer" :class="{ 'bg-yellow-500': turn === 0 }" @click="setTurn(0)">Draw phase</div>
      <div class="cursor-pointer" :class="{ 'bg-yellow-500': turn === 1 }" @click="setTurn(1)">Standby phase</div>
      <div class="cursor-pointer" :class="{ 'bg-yellow-500': turn === 2 }" @click="setTurn(2)">Main phase 1</div>
      <div class="cursor-pointer" :class="{ 'bg-yellow-500': turn === 3 }" @click="setTurn(3)">Battle phase</div>
      <div class="cursor-pointer" :class="{ 'bg-yellow-500': turn === 4 }" @click="setTurn(4)">Main phase 2</div>
      <div class="cursor-pointer" :class="{ 'bg-yellow-500': turn === 5 }" @click="setTurn(5)">End phase</div>
    </div>
    <!-- <div class="my-8 max-h-[min(90vw,90vh)] max-w-[min(90vw,90vh)] min-w-4xl basis-[100vw]"> -->
    <div class="w-[70vh]">
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
        @log="log"
        class="mb-20"
      />
    </div>
    <div class="flex flex-col gap-2 text-[min(1vh,1vw)] font-bold text-white">
      <p class="cursor-pointer" :class="{ 'bg-yellow-500': turn >= 6 }" @click="setTurn(6)">
        {{ playerKey === 'player2' ? "Opponent's turn" : 'Your turn' }}
      </p>
      <div class="cursor-pointer" :class="{ 'bg-yellow-500': turn === 6 }" @click="setTurn(6)">Draw phase</div>
      <div class="cursor-pointer" :class="{ 'bg-yellow-500': turn === 7 }" @click="setTurn(7)">Standby phase</div>
      <div class="cursor-pointer" :class="{ 'bg-yellow-500': turn === 8 }" @click="setTurn(8)">Main phase 1</div>
      <div class="cursor-pointer" :class="{ 'bg-yellow-500': turn === 9 }" @click="setTurn(9)">Battle phase</div>
      <div class="cursor-pointer" :class="{ 'bg-yellow-500': turn === 10 }" @click="setTurn(10)">Main phase 2</div>
      <div class="cursor-pointer" :class="{ 'bg-yellow-500': turn === 11 }" @click="setTurn(11)">End phase</div>
    </div>
  </div>
</template>
