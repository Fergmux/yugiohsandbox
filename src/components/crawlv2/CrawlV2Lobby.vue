<template>
  <div class="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">
    <div class="flex w-full max-w-2xl flex-col items-center gap-6 rounded-xl bg-gray-800 p-8 shadow-2xl">
      <h1 class="text-3xl font-bold">CrawlV2 Lobby</h1>

      <!-- Create / Join -->
      <div v-if="!game" class="flex w-full flex-col items-center gap-4">
        <button
          @click="createGame"
          :disabled="loading"
          class="w-full rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold hover:bg-emerald-500 disabled:opacity-50"
        >
          Create Game
        </button>

        <div class="flex w-full items-center gap-2">
          <input
            v-model="joinCode"
            type="number"
            placeholder="Enter game code"
            class="flex-1 rounded-lg bg-gray-700 px-4 py-3 text-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
          />
          <button
            @click="joinGame"
            :disabled="loading || !joinCode"
            class="rounded-lg bg-blue-600 px-6 py-3 text-lg font-bold hover:bg-blue-500 disabled:opacity-50"
          >
            Join
          </button>
        </div>

        <p v-if="error" class="text-sm text-red-400">{{ error }}</p>
      </div>

      <!-- Lobby (game created, waiting for players / deck selection) -->
      <template v-else>
        <div class="flex w-full items-center justify-between rounded-lg bg-gray-700 px-4 py-3">
          <span class="text-gray-300">Game Code:</span>
          <span class="text-2xl font-bold tracking-widest text-emerald-400">{{ game.code }}</span>
        </div>

        <!-- Players -->
        <div class="flex w-full gap-4">
          <div
            v-for="p in (['player1', 'player2'] as const)"
            :key="p"
            class="flex flex-1 flex-col items-center gap-2 rounded-lg bg-gray-700 p-4"
            :class="{ 'ring-2 ring-emerald-400': p === myPlayer }"
          >
            <span class="text-sm text-gray-400">{{ p === 'player1' ? 'Player 1' : 'Player 2' }}</span>
            <span v-if="game.players[p]" class="text-lg font-bold">
              {{ game.players[p]!.username }}
            </span>
            <span v-else class="text-lg italic text-gray-500">Waiting...</span>

            <!-- Ready indicator -->
            <span
              v-if="game.decks[p]?.ready"
              class="rounded bg-emerald-600 px-2 py-0.5 text-xs font-bold"
            >
              READY
            </span>
            <span
              v-else-if="game.decks[p]?.cardIds?.length"
              class="rounded bg-amber-600 px-2 py-0.5 text-xs font-bold"
            >
              DECK SELECTED
            </span>
          </div>
        </div>

        <!-- Deck Selection (only for current player) -->
        <div v-if="myPlayer && !game.decks[myPlayer]?.ready" class="flex w-full flex-col gap-3">
          <h2 class="text-lg font-bold">Select Your Deck</h2>

          <div class="flex flex-wrap gap-3">
            <button
              v-for="(deck, idx) in availableDecks"
              :key="idx"
              @click="selectedDeckIdx = idx"
              class="rounded-lg px-4 py-2 font-bold transition-all"
              :class="
                selectedDeckIdx === idx
                  ? 'bg-emerald-600 ring-2 ring-emerald-300'
                  : 'bg-gray-600 hover:bg-gray-500'
              "
            >
              {{ deck.name }}
            </button>
          </div>

          <div v-if="selectedDeckIdx !== null" class="flex items-center gap-3">
            <button
              v-if="!game.decks[myPlayer]?.cardIds?.length"
              @click="selectDeck"
              :disabled="loading"
              class="rounded-lg bg-blue-600 px-6 py-2 font-bold hover:bg-blue-500 disabled:opacity-50"
            >
              Confirm Deck
            </button>
            <button
              v-if="game.decks[myPlayer]?.cardIds?.length && !game.decks[myPlayer]?.ready"
              @click="readyUp"
              :disabled="loading"
              class="rounded-lg bg-emerald-600 px-6 py-2 font-bold hover:bg-emerald-500 disabled:opacity-50"
            >
              Ready Up
            </button>
          </div>
        </div>

        <!-- Waiting message -->
        <p v-else-if="myPlayer && game.decks[myPlayer]?.ready" class="text-lg text-emerald-300">
          Waiting for opponent...
        </p>

        <p v-if="error" class="text-sm text-red-400">{{ error }}</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase/client'
import { authFetch } from '@/lib/authFetch'
import { useUserStore } from '@/stores/user'
import { defaultDeck1Ids, defaultDeck2Ids, defaultDeckxIds } from '@/types/defaultGameState'
import type { CrawlV2Game, Player } from '@/types/crawlv2-multiplayer'
import { v4 as uuid } from 'uuid'

const emit = defineEmits<{
  (e: 'game-started', game: CrawlV2Game, gameId: string, myPlayer: Player): void
}>()

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const game = ref<CrawlV2Game | null>(null)
const gameId = ref<string | null>(null)
const joinCode = ref<string>('')
const loading = ref(false)
const error = ref<string | null>(null)
const selectedDeckIdx = ref<number | null>(null)

let unsubscribe: Unsubscribe | null = null

const availableDecks = [
  { name: 'Mage', cardIds: defaultDeck1Ids },
  { name: 'Dragon', cardIds: defaultDeckxIds },
  { name: 'Warrior', cardIds: defaultDeck2Ids },
]

const myPlayer = computed<Player | null>(() => {
  if (!game.value || !userStore.user) return null
  if (game.value.players.player1?.uid === userStore.user.firebaseUid) return 'player1'
  if (game.value.players.player2?.uid === userStore.user.firebaseUid) return 'player2'
  return null
})

function subscribe(id: string) {
  unsubscribe?.()
  unsubscribe = onSnapshot(doc(db, 'crawlv2_games', id), (snap) => {
    const data = snap.data() as CrawlV2Game | undefined
    if (!data) return
    game.value = data

    // If game just transitioned to active, emit event
    if (data.status === 'active' && myPlayer.value) {
      emit('game-started', data, id, myPlayer.value)
    }
  })
}

async function createGame() {
  loading.value = true
  error.value = null
  try {
    const res = await authFetch('/.netlify/functions/create-crawlv2', {
      method: 'POST',
      body: JSON.stringify({ username: userStore.user?.username }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    gameId.value = data.id
    router.replace({ params: { gameCode: String(data.code) } })
    subscribe(data.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create game'
  } finally {
    loading.value = false
  }
}

async function joinGame() {
  loading.value = true
  error.value = null
  try {
    const res = await authFetch('/.netlify/functions/join-crawlv2', {
      method: 'POST',
      body: JSON.stringify({
        code: Number(joinCode.value),
        username: userStore.user?.username,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    gameId.value = data.id
    router.replace({ params: { gameCode: String(data.code ?? joinCode.value) } })
    subscribe(data.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to join game'
  } finally {
    loading.value = false
  }
}

async function sendAction(action: Record<string, unknown>) {
  loading.value = true
  error.value = null
  try {
    const res = await authFetch('/.netlify/functions/crawlv2-action', {
      method: 'POST',
      body: JSON.stringify({ gameId: gameId.value, action: { ...action, actionId: uuid() } }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message ?? data.error)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Action failed'
  } finally {
    loading.value = false
  }
}

async function selectDeck() {
  if (selectedDeckIdx.value === null) return
  const deck = availableDecks[selectedDeckIdx.value]
  await sendAction({ type: 'select_deck', cardIds: deck.cardIds })
}

async function readyUp() {
  await sendAction({ type: 'ready_up' })
}

// Auto-join if gameCode is in the route
if (route.params.gameCode) {
  joinCode.value = route.params.gameCode as string
  joinGame()
}
</script>
