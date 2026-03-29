<script setup lang="ts">
import type { ComputedRef, Ref } from 'vue'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'

import { doc, onSnapshot } from 'firebase/firestore'
import { debounce } from 'lodash'
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { useRoute } from 'vue-router'

import InspectModal from '@/components/InspectModal.vue'
import InviteFriendsModal from '@/components/InviteFriendsModal.vue'
import CoinFlip from '@/components/play-space/CoinFlip.vue'
import FieldSide from '@/components/play-space/FieldSide.vue'
import { useCrawlManager } from '@/composables/crawler/crawlManager'
import { usePageManager } from '@/composables/crawler/pageManager'
import { useConfetti } from '@/composables/crawler/useConfetti'
import { useFieldShortcuts } from '@/composables/useFieldShortcuts'
import { db } from '@/firebase/client'
import { useDeckStore } from '@/stores/deck'
import { useUserStore } from '@/stores/user'
import { extraDeckTypes, mainDeckTypes } from '@/types/filters'
import type { CardSelection } from '@/types/crawl'
import type { BoardSide, GameEdit, GameState, YugiohCard } from '@/types/yugiohCard'
import { applyEdits } from '@/utils/applyEdit'
import { useClipboard } from '@vueuse/core'

/*
TODO:
- button component
- align login page with join game page


CRAWLER
- Powers display
- Whole deck display 
- Draw pile randomised





PLAYSPACE
New Features
- Spectator count
- text search deck
- Player name indicators
- Login password/username
- Admin portal?
- User profile page?
- Ensure mobile works?
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

const { newDuel, finishDuel, winDuel, crawl, setSelectedOpponentCard } = useCrawlManager()

const { next } = usePageManager()

const props = defineProps<{
  crawlPlayer?: 'player1' | 'player2' | null
}>()

const turnNameMap = ['Draw', 'Standby', 'Main 1', 'Battle', 'Main 2', 'End']

function createDefaultGameState(): GameState {
  return {
    _version: 0,
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
      player1: props.crawlPlayer ? 4000 : 8000,
      player2: props.crawlPlayer ? 4000 : 8000,
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
  if (props.crawlPlayer) {
    if (!crawl.value.duelId) {
      await createGame()
      if (gameId.value) {
        await newDuel(gameId.value)
      } else {
        console.error('Error creating game, no gameId')
      }
      await setDeck(crawl.value[props.crawlPlayer].deck)
    } else {
      await joinGame(crawl.value.duelId)
      await setDeck(crawl.value[props.crawlPlayer].deck)
    }
  }
})

const gameId: Ref<string | undefined> = ref()
const gameCode: Ref<number | undefined> = ref()
const deckId: Ref<string | undefined> = ref()
let unsubscribe: () => void
const joinUrl = computed(() => `${window.location.origin}/play/${gameCode.value}`)
const viewDeck = ref(false)
const powerDescription = ref<string | null>(null)
const activatedPowerIds = ref<Set<string>>(new Set())

interface EditBatch {
  edits: GameEdit[]
  serverVersion: number | null
}

const serverSnapshot = shallowRef<GameState>(createDefaultGameState())
const pendingEdits = shallowRef<GameEdit[]>([])
const inflightBatches = shallowRef<EditBatch[]>([])
let sending = false

const gameState = computed<GameState>(() => {
  const base = JSON.parse(JSON.stringify(serverSnapshot.value)) as GameState
  for (const batch of inflightBatches.value) {
    applyEdits(base, batch.edits)
  }
  applyEdits(base, pendingEdits.value)
  return base
})
const { copy } = useClipboard({ source: joinUrl.value })

const createGame = async () => {
  const initial = createDefaultGameState()
  gameCode.value = Math.floor(Math.random() * 10000)
  initial.code = gameCode.value
  initial.players.player1 = userStore.user ?? null
  serverSnapshot.value = initial
  pendingEdits.value = []
  inflightBatches.value = []
  try {
    const response = await fetch('/.netlify/functions/create-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameState: initial }),
    })
    const data = await response.json()
    gameId.value = data.id
  } catch (e) {
    console.error('Error adding document: ', e)
  }
  subscribe()
}

const leaveGame = () => {
  gameId.value = undefined
  gameCode.value = undefined
  deckId.value = undefined
  serverSnapshot.value = createDefaultGameState()
  pendingEdits.value = []
  inflightBatches.value = []
  sending = false
  unsubscribe()
}

const iWin = async () => {
  await winDuel()
  leaveGame()
  next()
}

const iLose = () => {
  leaveGame()
  finishDuel()
  next()
}

type CoinFlipComponent = {
  flip: (desiredSide?: 'heads' | 'tails') => void
}

const coinRef = ref<CoinFlipComponent | null>(null)
const createLogEntry = (action: string): GameEdit => {
  const entry = { text: `${userStore.user?.username} ${action}`, timestamp: new Date().getTime() }
  return { type: 'append_log', entries: [entry] }
}

const flipCoin = (result: 'heads' | 'tails') => {
  const count = gameState.value.coinFlip?.[1] ?? 0
  sendEdits([{ type: 'set_coin_flip', coinFlip: [result, count + 1] }, createLogEntry('flipped a coin')])
}
watch(
  () => gameState.value.coinFlip?.[1],
  (count, oldCount) => {
    if (count !== undefined && oldCount !== undefined && count !== oldCount) {
      coinRef.value?.flip(gameState.value.coinFlip![0])
    }
  },
)

const logRef = ref<HTMLDivElement | null>(null)
const textChat = ref('')
const showChat = ref(false)
const sendChat = () => {
  if (!textChat.value) return
  sendEdits([createLogEntry(`: ${textChat.value}`)])
  textChat.value = ''
}
const turn = computed(() => gameState.value.turn)
const setTurn = (turn: number) => {
  sendEdits([{ type: 'set_turn', turn }, createLogEntry(`set turn to ${turnNameMap[turn % 6]}`)])
}
const { registerShortcut } = useFieldShortcuts()

registerShortcut('Enter', () => {
  if (!gameId.value || !props.crawlPlayer) return

  const playerCards = gameState.value.cards[playerKey.value]
  const steps: GameEdit[][] = []

  // One step per hand card → graveyard
  for (const card of playerCards.hand.filter(Boolean)) {
    steps.push([{
      type: 'move_card',
      player: playerKey.value,
      cardUid: card.uid,
      fromLocation: 'hand',
      toLocation: 'graveyard',
      cardData: { ...card, faceDown: false, defence: false, counters: 0, newAttack: null, newDefence: null },
    }])
  }

  // Simulate deck/graveyard state after hand is cleared, then build draw steps
  let graveyard = [
    ...playerCards.hand.filter(Boolean).map((c) => ({ ...c, faceDown: false })),
    ...playerCards.graveyard,
  ]
  let deck = [...playerCards.deck]
  let drawn = 0

  while (drawn < 4) {
    if (deck.length === 0) {
      if (!graveyard.length) break
      const shuffled = [...graveyard].sort(() => Math.random() - 0.5).map((c) => ({ ...c, faceDown: true }))
      steps.push([
        { type: 'set_zone', player: playerKey.value, location: 'deck', cards: shuffled },
        { type: 'set_zone', player: playerKey.value, location: 'graveyard', cards: [] },
      ])
      deck = shuffled
      graveyard = []
    }
    const card = deck[0]
    steps.push([{
      type: 'move_card',
      player: playerKey.value,
      cardUid: card.uid,
      fromLocation: 'deck',
      toLocation: 'hand',
      cardData: { ...card, faceDown: true },
    }])
    deck = deck.slice(1)
    drawn++
  }

  steps.forEach((edits, i) => setTimeout(() => sendEdits(edits), i * 200))
})

// Handle spacebar press to increment turn
const handleKeyUp = (event: KeyboardEvent) => {
  if (event.code === 'Space' && gameId.value) {
    event.preventDefault()
    const newTurn = (turn.value + 1) % 12
    setTurn(newTurn)
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.code === 'Space' && gameId.value) {
    event.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})

const cardIdsToCards = (cardIds: number[]) => {
  return cardIds.map((cardId) => {
    const card = allCards.value.find((card) => card.id === cardId)
    if (card) {
      return { ...card, uid: uuidv4() }
    }
    return undefined
  })
}

const cardsInDeck: ComputedRef<YugiohCard[]> = computed(() => {
  return cardIdsToCards(decks.value.find((deck) => deck.id === deckId.value)?.cards ?? []).filter(
    Boolean,
  ) as YugiohCard[]
})

const cardsInNormalDeck = computed(() =>
  cardsInDeck.value
    .filter((card) => mainDeckTypes.includes(card.type))
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
const crawlDeckCards = ref<YugiohCard[]>([])
const setDeck = (id: string | number[]) => {
  if (Array.isArray(id)) {
    deckId.value = uuidv4()
    const deckCards = cardIdsToCards(id)
      .filter((c): c is YugiohCard => c !== undefined)
      .filter((c) => mainDeckTypes.includes(c.type))
      .map((c) => ({ ...c, faceDown: true }))
    crawlDeckCards.value = deckCards
    const shuffledDeck = deckCards.sort(() => Math.random() - 0.5)
    sendEdits([
      { type: 'set_zone', player: playerKey.value, location: 'deck', cards: [...shuffledDeck] },
      { type: 'set_deck_id', player: playerKey.value, deckId: deckId.value },
    ])
  } else {
    deckId.value = id
    const shuffledDeck = [...cardsInNormalDeck.value].sort(() => Math.random() - 0.5)
    sendEdits([
      { type: 'set_zone', player: playerKey.value, location: 'deck', cards: [...shuffledDeck] },
      { type: 'set_zone', player: playerKey.value, location: 'tokens', cards: [...tokensInDeck.value] },
      { type: 'set_zone', player: playerKey.value, location: 'extra', cards: [...cardsInExtraDeck.value] },
      { type: 'set_deck_id', player: playerKey.value, deckId: id },
    ])
  }
}

const doFlush = async () => {
  if (!gameId.value || pendingEdits.value.length === 0 || sending) return
  sending = true
  const edits = pendingEdits.value
  pendingEdits.value = []
  const batch: EditBatch = { edits, serverVersion: null }
  inflightBatches.value = [...inflightBatches.value, batch]
  try {
    const response = await fetch('/.netlify/functions/update-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: gameId.value, edits }),
    })
    const data = await response.json()
    batch.serverVersion = data.version
    const snapshotVersion = serverSnapshot.value._version ?? 0
    if (batch.serverVersion !== null && batch.serverVersion <= snapshotVersion) {
      inflightBatches.value = inflightBatches.value.filter((b) => b !== batch)
    }
  } catch {
    pendingEdits.value = [...edits, ...pendingEdits.value]
    inflightBatches.value = inflightBatches.value.filter((b) => b !== batch)
  } finally {
    sending = false
    if (pendingEdits.value.length > 0) doFlush()
  }
}

const flushEdits = debounce(doFlush, 100)

const sendEdits = (edits: GameEdit[]) => {
  pendingEdits.value = [...pendingEdits.value, ...edits]
  flushEdits()
}

const joinGame = async (id?: string) => {
  try {
    let response
    if (id) {
      response = await fetch(`/.netlify/functions/get-game/${id}`)
      if (!response.ok) {
        console.error('Game not found')
        return
      }
    } else {
      response = await fetch(`/.netlify/functions/get-game-by-code/${gameCode.value}`)
      if (!response.ok) {
        console.error('Game not found')
        return
      }
    }
    const gameData = (await response.json()) as GameState & { id: string }
    gameId.value = gameData.id
    gameCode.value = gameData.code || undefined
    serverSnapshot.value = gameData
    pendingEdits.value = []
    inflightBatches.value = []
    if (gameData.players.player1?.id === userStore.user?.id) {
      deckId.value = gameData.decks.player1 ?? undefined
    } else if (gameData.players.player2?.id === userStore.user?.id) {
      deckId.value = gameData.decks.player2 ?? undefined
    } else if (!gameData.players.player2) {
      await fetch('/.netlify/functions/update-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: gameId.value,
          edits: [{ type: 'set_player', player: 'player2', user: userStore.user ?? null }],
        }),
      })
    }
    subscribe()
  } catch (e) {
    console.error('Error joining game:', e)
  }
}

const handleEdit = (edits: GameEdit[], logText?: string) => {
  if (logText) {
    edits.push(createLogEntry(logText))
  }
  sendEdits(edits)
}

const subscribe = () => {
  if (!gameId.value) return
  unsubscribe = onSnapshot(doc(db, 'games', gameId.value), (docSnapshot) => {
    const serverState = docSnapshot.data() as GameState
    const snapshotVersion = serverState._version ?? 0
    serverSnapshot.value = serverState
    const remaining = inflightBatches.value.filter((b) => b.serverVersion === null || b.serverVersion > snapshotVersion)
    if (remaining.length !== inflightBatches.value.length) {
      inflightBatches.value = remaining
    }
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
const playerKey: ComputedRef<'player1' | 'player2'> = computed(
  () => props.crawlPlayer ?? (player.value === 'player2' ? 'player2' : 'player1'),
)
const opponentKey: ComputedRef<'player1' | 'player2'> = computed(() => {
  return playerKey.value === 'player1' ? 'player2' : 'player1'
})
const { celebrate } = useConfetti()
watch(
  () => {
    return gameState.value.lifePoints[opponentKey.value]
  },
  (lp) => {
    if (lp <= 0) {
      setTimeout(() => {
        celebrate()
      }, 1600)
    }
  },
)

const notesRef = ref<HTMLTextAreaElement | null>(null)
const showNotes = ref(false)
const showInviteModal = ref(false)

type FieldSideInstance = { resetSelectedCard: () => void }
const playerFieldRef = ref<FieldSideInstance | null>(null)
const opponentFieldRef = ref<FieldSideInstance | null>(null)
const gameSpaceRef = ref<HTMLElement | null>(null)

const mySelectedOpponentCard = computed<CardSelection>(() => {
  if (!props.crawlPlayer) return null
  return crawl.value[playerKey.value]?.selectedOpponentCard ?? null
})

const opponentSelectedMyCard = computed<CardSelection>(() => {
  if (!props.crawlPlayer) return null
  return crawl.value[opponentKey.value]?.selectedOpponentCard ?? null
})

const handleOpponentCardSelect = (_location: keyof BoardSide, _index: number) => {
  if (!props.crawlPlayer) return
  playerFieldRef.value?.resetSelectedCard()
  const current = crawl.value[playerKey.value]?.selectedOpponentCard
  if (current?.location === _location && current?.index === _index) {
    setSelectedOpponentCard(null)
  } else {
    setSelectedOpponentCard({ location: _location, index: _index })
  }
}

const clearOpponentSelection = () => {
  if (!props.crawlPlayer) return
  if (crawl.value[playerKey.value]?.selectedOpponentCard) {
    setSelectedOpponentCard(null)
  }
}

const handleClickOutsideGameSpace = (e: MouseEvent) => {
  if (!gameSpaceRef.value?.contains(e.target as Node)) {
    playerFieldRef.value?.resetSelectedCard()
    opponentFieldRef.value?.resetSelectedCard()
    clearOpponentSelection()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutsideGameSpace)
})
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutsideGameSpace)
})
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
          @keyup.enter.stop="sendChat"
          @keyup.space.stop
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
        @keyup.enter="joinGame()"
      />
      <button @click="joinGame()" class="cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600">
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
    <template v-if="props.crawlPlayer">
      <p class="text-lg">
        Room code: <span class="text-lg font-bold">{{ gameCode }}</span>
      </p>
      <p class="text-lg">
        Round: <span class="text-lg font-bold">{{ crawl.round }}</span>
      </p>
      <p class="text-lg">Score</p>
      <p class="text-lg">
        You: <span class="font-bold">{{ crawl[playerKey].wins ?? 0 }}</span> - {{ crawl[opponentKey].name }}:
        <span class="font-bold">{{ crawl[opponentKey].wins ?? 0 }}</span>
      </p>
      <button @click="iWin" class="mt-4 ml-4 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600">
        I Win
      </button>
      <button
        @click="iLose"
        class="mt-4 ml-4 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
      >
        I Lose
      </button>
      <button
        @click="viewDeck = !viewDeck"
        class="mt-4 ml-4 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
      >
        View Deck
      </button>
    </template>
    <template v-else>
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
      <button
        @click="showInviteModal = true"
        class="mt-4 ml-4 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
      >
        Invite Friend
      </button>
    </template>

    <br />
    <coin-flip ref="coinRef" class="mx-auto mt-2" @flip="flipCoin" />
    <template v-if="props.crawlPlayer && crawl[opponentKey].powers.length">
      <p class="mx-auto my-4 max-w-full text-center break-words">
        {{ powerDescription ? powerDescription : "Opponent's powers" }}
      </p>
      <div class="mx-auto mt-4 flex w-max gap-4">
        <div
          v-for="power in crawl[opponentKey].powers"
          @mouseover="powerDescription = power.description"
          @mouseleave="powerDescription = null"
          :key="power.id"
          class="cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
        >
          <!-- TODO: track opponent's activated powers
          :class="{ 'bg-yellow-600': activatedPowerIds.has(power.id) }"
          @click="
            activatedPowerIds.has(power.id) ? activatedPowerIds.delete(power.id) : activatedPowerIds.add(power.id)
          " -->
          {{ power.name }}
        </div>
      </div>
    </template>
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
      <p class="cursor-pointer" :class="{ 'bg-yellow-500': turn < 6 }" @click="setTurn(0)">
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
    <div class="w-[70vh]" ref="gameSpaceRef">
      <!-- OPPONENT -->
      <field-side
        ref="opponentFieldRef"
        v-if="gameId"
        :game-state="gameState"
        :player="playerKey === 'player2' ? 'player1' : 'player2'"
        :viewer="player === null"
        :crawl="props.crawlPlayer !== null"
        :my-selected-opponent-card="mySelectedOpponentCard"
        @edit="handleEdit"
        @select-opponent-card="handleOpponentCardSelect"
        class="mb-2 rotate-180"
      />
      <!-- PLAYER -->
      <field-side
        ref="playerFieldRef"
        v-if="gameId"
        :game-state="gameState"
        :player="playerKey"
        :interactive="player !== null"
        :viewer="player === null"
        :crawl="props.crawlPlayer !== null"
        :opponent-selected-card="opponentSelectedMyCard"
        @edit="handleEdit"
        @card-selected="clearOpponentSelection"
        class="mb-2"
      />
      <template v-if="props.crawlPlayer && crawl[props.crawlPlayer].powers.length">
        <br />
        <div class="mx-auto flex w-max gap-4">
          <div
            v-for="power in crawl[props.crawlPlayer].powers"
            @mouseover="powerDescription = power.description"
            @mouseleave="powerDescription = null"
            :key="power.id"
            class="cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
            :class="{ 'bg-yellow-600': activatedPowerIds.has(power.id) }"
            @click="
              activatedPowerIds.has(power.id) ? activatedPowerIds.delete(power.id) : activatedPowerIds.add(power.id)
            "
          >
            {{ power.name }}
          </div>
        </div>
        <p class="mx-auto mt-4 mb-40 max-w-full text-center break-words">
          {{ powerDescription ? powerDescription : 'Your powers' }}
        </p>
      </template>
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
    <inspect-modal v-if="viewDeck" :cards="crawlDeckCards" :showCards="crawlDeckCards" @close="viewDeck = false" />
  </div>
  <invite-friends-modal
    v-if="showInviteModal && gameCode"
    type="game"
    :game-code="String(gameCode)"
    @close="showInviteModal = false"
  />
</template>
