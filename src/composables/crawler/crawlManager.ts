import { computed, ref } from 'vue'

import { doc, onSnapshot } from 'firebase/firestore'

import { db } from '@/firebase/client'
import { useUserStore } from '@/stores/user'
import type { Crawl, Power } from '@/types/crawl'
import { useClipboard } from '@vueuse/core'

const defaultCrawl: Crawl = {
  code: null,
  round: 0,
  duelId: null,
  created: null,
  player1: {
    id: null,
    name: null,
    deck: [],
    powers: [],
    page: 0,
    wins: 0,
  },
  player2: {
    id: null,
    name: null,
    deck: [],
    powers: [],
    page: 0,
    wins: 0,
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

/**
 * Reference-counted pending field tracker.
 * While a field has a count > 0, incoming snapshots won't overwrite
 * the local value for that field, preventing remote data from clobbering
 * optimistic updates that are still in-flight.
 */
const pendingCounts = new Map<string, number>()

function markPending(key: string) {
  pendingCounts.set(key, (pendingCounts.get(key) ?? 0) + 1)
}

function unmarkPending(key: string) {
  const count = (pendingCounts.get(key) ?? 1) - 1
  if (count <= 0) pendingCounts.delete(key)
  else pendingCounts.set(key, count)
}

function isPending(key: string) {
  return (pendingCounts.get(key) ?? 0) > 0
}

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

  const powers = computed(() => {
    if (player.value) {
      return crawl.value[player.value].powers
    }
    return []
  })

  const deck = computed(() => {
    if (player.value) {
      return crawl.value[player.value].deck
    }
    return []
  })

  const joinUrl = computed(() => `${window.location.origin}/crawler/${gameCode.value}`)
  const { copy } = useClipboard({ source: joinUrl.value })

  const sendUpdate = async (fields: Record<string, unknown>) => {
    await fetch('/.netlify/functions/update-crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: gameId.value, ...fields }),
    })
  }

  const createGame = async () => {
    crawl.value.code = Math.floor(Math.random() * 10000)
    crawl.value.created = new Date().toISOString()
    crawl.value.player1.id = userStore.user?.id ?? null
    crawl.value.player1.name = userStore.user?.username ?? null
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
      const gameData = await response.json()
      gameId.value = gameData.id
      subscribe()
      await sendUpdate({
        player2: {
          id: userStore.user?.id ?? null,
          name: userStore.user?.username ?? null,
          deck: [],
          powers: [],
        },
      })
    } catch (e) {
      console.error('Error joining game:', e)
    }
  }

  const subscribe = () => {
    if (!gameId.value) return
    unsubscribe = onSnapshot(doc(db, 'crawls', gameId.value), (snapshot) => {
      const remote = snapshot.data() as Crawl

      if (!player.value || pendingCounts.size === 0) {
        crawl.value = remote
        return
      }

      const other = player.value === 'player1' ? 'player2' : 'player1'
      const self = player.value

      crawl.value[other] = { ...remote[other] }

      if (!isPending('duelId')) crawl.value.duelId = remote.duelId
      if (!isPending('round')) crawl.value.round = remote.round
      if (!isPending('code')) crawl.value.code = remote.code

      if (!isPending(`${self}.deck`)) crawl.value[self].deck = [...remote[self].deck]
      if (!isPending(`${self}.powers`)) crawl.value[self].powers = [...remote[self].powers]
      if (!isPending(`${self}.id`)) crawl.value[self].id = remote[self].id
      if (!isPending(`${self}.page`)) crawl.value[self].page = remote[self].page
    })
  }

  const leaveGame = () => {
    gameId.value = null
    gameCode.value = null
    crawl.value = { ...defaultCrawl, player1: { ...defaultCrawl.player1 }, player2: { ...defaultCrawl.player2 } }
    pendingCounts.clear()
    if (unsubscribe) {
      unsubscribe()
    }
  }

  const newDuel = async (id: string) => {
    const newRound = crawl.value.round + 1
    crawl.value.duelId = id
    crawl.value.round = newRound
    markPending('duelId')
    markPending('round')
    try {
      await sendUpdate({ duelId: id, round: newRound })
    } finally {
      unmarkPending('duelId')
      unmarkPending('round')
    }
  }

  const finishDuel = async () => {
    crawl.value.duelId = null
    markPending('duelId')
    try {
      await sendUpdate({ duelId: null })
    } finally {
      unmarkPending('duelId')
    }
  }

  const winDuel = async () => {
    if (!player.value) return
    const p = player.value
    const winsKey = `${p}.wins`
    const newWins = (crawl.value[p].wins ?? 0) + 1
    crawl.value[p].wins = newWins
    crawl.value.duelId = null
    markPending(winsKey)
    markPending('duelId')
    try {
      await sendUpdate({ [winsKey]: newWins, duelId: null })
    } finally {
      unmarkPending(winsKey)
      unmarkPending('duelId')
    }
  }

  const addPowerToUser = async (power: Power) => {
    if (!player.value) return
    const p = player.value
    const key = `${p}.powers`
    const newPowers = [...crawl.value[p].powers, power]
    crawl.value[p].powers = newPowers
    markPending(key)
    try {
      await sendUpdate({ [key]: newPowers })
    } finally {
      unmarkPending(key)
    }
  }

  const removePowerFromUser = async (id: string) => {
    if (!player.value) return
    const p = player.value
    const key = `${p}.powers`
    const currentPowers = crawl.value[p].powers
    const idx = currentPowers.findIndex((power) => power.id === id)
    const newPowers = idx === -1 ? currentPowers : [...currentPowers.slice(0, idx), ...currentPowers.slice(idx + 1)]
    crawl.value[p].powers = newPowers
    markPending(key)
    try {
      await sendUpdate({ [key]: newPowers })
    } finally {
      unmarkPending(key)
    }
  }

  const addCardToDeck = async (id: number) => {
    if (!player.value) return
    const p = player.value
    const key = `${p}.deck`
    const newDeck = [...crawl.value[p].deck, id]
    crawl.value[p].deck = newDeck
    markPending(key)
    try {
      await sendUpdate({ [key]: newDeck })
    } finally {
      unmarkPending(key)
    }
  }

  const removeCardFromDeck = async (id: number) => {
    if (!player.value) return
    const p = player.value
    const key = `${p}.deck`
    const currentDeck = crawl.value[p].deck
    const idx = currentDeck.indexOf(id)
    const newDeck = idx === -1 ? currentDeck : [...currentDeck.slice(0, idx), ...currentDeck.slice(idx + 1)]
    crawl.value[p].deck = newDeck
    markPending(key)
    try {
      await sendUpdate({ [key]: newDeck })
    } finally {
      unmarkPending(key)
    }
  }

  const updatePage = async (page: number) => {
    if (!player.value) return
    const p = player.value
    const key = `${p}.page`
    crawl.value[p].page = page
    markPending(key)
    try {
      await sendUpdate({ [key]: page })
    } finally {
      unmarkPending(key)
    }
  }

  const loadCrawl = (crawlData: Crawl & { id: string }) => {
    const { id, ...rest } = crawlData
    gameId.value = id
    gameCode.value = rest.code
    crawl.value = rest
    subscribe()
  }

  const deleteCrawl = async (id: string): Promise<void> => {
    await fetch('/.netlify/functions/delete-crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  const getCrawls = async (): Promise<(Crawl & { id: string })[]> => {
    const userId = userStore.user?.id
    if (!userId) return []
    try {
      const response = await fetch(`/.netlify/functions/get-crawls/${userId}`)
      if (!response.ok) return []
      const data: (Crawl & { id: string })[] = await response.json()
      return data.sort((a, b) => {
        if (!a.created) return 1
        if (!b.created) return -1
        return new Date(b.created).getTime() - new Date(a.created).getTime()
      })
    } catch (e) {
      console.error('Error fetching crawls:', e)
      return []
    }
  }

  return {
    crawl,
    player,
    powers,
    deck,
    gameId,
    gameCode,
    joinUrl,
    copy,
    joinGame,
    createGame,
    leaveGame,
    newDuel,
    finishDuel,
    winDuel,
    addPowerToUser,
    removePowerFromUser,
    addCardToDeck,
    removeCardFromDeck,
    getCrawls,
    deleteCrawl,
    updatePage,
    loadCrawl,
  }
}
