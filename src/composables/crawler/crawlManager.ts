import { computed, ref } from 'vue'

import { doc, onSnapshot } from 'firebase/firestore'

import { db } from '@/firebase/client'
import { useUserStore } from '@/stores/user'
import { useClipboard } from '@vueuse/core'

interface Crawl {
  code: number | null
  round: number
  duelId: string | null
  player1: {
    id: string | null
    deck: number[]
    powers: string[]
  }
  player2: {
    id: string | null
    deck: number[]
    powers: string[]
  }
}

const defaultCrawl: Crawl = {
  code: null,
  round: 0,
  duelId: null,
  player1: {
    id: null,
    deck: [],
    powers: [],
  },
  player2: {
    id: null,
    deck: [],
    powers: [],
  },
}

const gameId = ref<string | null>(null)
const gameCode = ref<number | null>(null)
const crawl = ref<Crawl>({
  ...defaultCrawl,
  player1: { ...defaultCrawl.player1 },
  player2: { ...defaultCrawl.player2 },
})

let unsubscribe: () => void

export const useCrawlManager = () => {
  const userStore = useUserStore()

  const player = computed(() => {
    if (crawl.value.player1.id === userStore.user?.id) {
      return 'player1'
    } else if (crawl.value.player2.id === userStore.user?.id) {
      return 'player2'
    }
    return null
  })

  const joinUrl = computed(() => `${window.location.origin}/crawler/${gameCode.value}`)
  const { copy } = useClipboard({ source: joinUrl.value })

  const createGame = async () => {
    crawl.value.code = Math.floor(Math.random() * 10000) // Random number between 0 and 9999
    crawl.value.player1.id = userStore.user?.id ?? null
    try {
      const response = await fetch('/.netlify/functions/create-crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crawl: crawl.value }),
      })
      const data = await response.json()
      gameCode.value = crawl.value.code
      gameId.value = data.id
      subscribe()
    } catch (e) {
      console.error('Error adding document: ', e)
    }
  }

  const joinGame = async () => {
    try {
      const response = await fetch(`/.netlify/functions/get-crawl-by-code/${gameCode.value}`)
      if (!response.ok) {
        console.error('Game not found')
        return
      }
      // const gameData = (await response.json()) as GameState & { id: string }
      const gameData = await response.json()
      gameId.value = gameData.id
      // if (gameData.players.player1?.id === userStore.user?.id) {
      //   deckId.value = gameData.decks.player1 ?? undefined
      // } else if (gameData.players.player2?.id === userStore.user?.id) {
      //   deckId.value = gameData.decks.player2 ?? undefined
      // } else if (!gameData.players.player2) {
      subscribe()
      await fetch('/.netlify/functions/update-crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...gameData,
          player2: {
            id: userStore.user?.id ?? null,
            deck: [],
            powers: [],
          },
        }),
      })
    } catch (e) {
      console.error('Error joining game:', e)
    }
  }

  const subscribe = () => {
    console.log('subscribing to game', gameId.value)
    if (!gameId.value) return
    unsubscribe = onSnapshot(doc(db, 'crawls', gameId.value), (doc) => {
      console.log('doc sub', doc.data())
      crawl.value = doc.data() as Crawl
      // logRef.value?.scrollTo({ top: logRef.value.scrollHeight, behavior: 'smooth' })
    })
  }

  const leaveGame = () => {
    gameId.value = null
    gameCode.value = null
    crawl.value = { ...defaultCrawl, player1: { ...defaultCrawl.player1 }, player2: { ...defaultCrawl.player2 } }
    if (unsubscribe) {
      unsubscribe()
    }
  }

  const newDuel = async (id: string) => {
    await fetch('/.netlify/functions/update-crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...crawl.value,
        duelId: id,
        round: crawl.value.round + 1,
      }),
    })
  }

  return {
    crawl,
    player,
    gameId,
    gameCode,
    joinUrl,
    copy,
    joinGame,
    createGame,
    leaveGame,
    newDuel,
  }
}
