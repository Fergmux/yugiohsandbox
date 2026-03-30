import { computed, ref } from 'vue'

import { doc, onSnapshot } from 'firebase/firestore'

import { db } from '@/firebase/client'
import { useUserStore } from '@/stores/user'
import type { CardSelection, Crawl, Power } from '@/types/crawl'
import { useClipboard } from '@vueuse/core'

const defaultCrawl: Crawl = {
  code: null,
  round: 0,
  duelId: null,
  created: null,
  modifiers: {
    drawCount: 4,
    rewards: 3,
    actionPoints: 2,
    totalDuels: 11,
  },
  player1: {
    id: null,
    name: null,
    deck: [],
    powers: [],
    page: 0,
    wins: 0,
    actionPoints: 2,
  },
  player2: {
    id: null,
    name: null,
    deck: [],
    powers: [],
    page: 0,
    wins: 0,
    actionPoints: 2,
  },
}

const crawl = ref<Crawl>(defaultCrawl)

const gameId = ref<string | null>(null)

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

  const gameCode = computed(() => crawl.value.code)

  const player = computed(() => {
    if (crawl.value.player1.id === userStore.user?.id) {
      return 'player1'
    } else if (crawl.value.player2.id === userStore.user?.id) {
      return 'player2'
    }
    return null
  })

  const opponent = computed(() => (player.value === 'player1' ? 'player2' : 'player1'))

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
      gameId.value = data.id
      subscribe()
    } catch (e) {
      console.error('Error adding document: ', e)
    }
  }

  const joinGame = async (code: number) => {
    const response = await fetch(`/.netlify/functions/get-crawl-by-code/${code}`)
    if (!response.ok) throw new Error('Game not found')
    const gameData = await response.json()
    const { id, ...crawlData } = gameData
    gameId.value = id
    crawl.value = crawlData
    subscribe()

    const userId = userStore.user?.id
    const isPlayer1 = gameData.player1?.id === userId
    const isPlayer2 = gameData.player2?.id === userId
    const player2Empty = !gameData.player2?.id

    // Only assign as player2 if not already a player and the slot is open
    if (!isPlayer1 && !isPlayer2 && player2Empty) {
      await sendUpdate({
        player2: {
          id: userStore.user?.id ?? null,
          name: userStore.user?.username ?? null,
          deck: [],
          powers: [],
          page: 0,
          wins: 0,
          actionPoints: crawl.value.modifiers?.actionPoints ?? 2,
        },
      })
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
      if (!isPending('modifiers')) crawl.value.modifiers = remote.modifiers

      if (!isPending(`${self}.deck`)) crawl.value[self].deck = [...remote[self].deck]
      if (!isPending(`${self}.powers`)) crawl.value[self].powers = [...remote[self].powers]
      if (!isPending(`${self}.id`)) crawl.value[self].id = remote[self].id
      if (!isPending(`${self}.page`)) crawl.value[self].page = remote[self].page
      if (!isPending(`${self}.actionPoints`)) crawl.value[self].actionPoints = remote[self].actionPoints ?? 2
      if (!isPending(`${self}.selectedOpponentCard`))
        crawl.value[self].selectedOpponentCard = remote[self].selectedOpponentCard ?? null
    })
  }

  const leaveGame = () => {
    gameId.value = null
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
    return newWins
  }

  const winOpponentDuel = async () => {
    if (!player.value) return
    const opp = player.value === 'player1' ? 'player2' : 'player1'
    const newWins = (crawl.value[opp].wins ?? 0) + 1
    crawl.value.duelId = null
    markPending('duelId')
    try {
      await sendUpdate({ [`${opp}.wins`]: newWins, duelId: null })
    } finally {
      unmarkPending('duelId')
    }
    return newWins
  }

  const setBothPages = async (page: number) => {
    crawl.value.player1.page = page
    crawl.value.player2.page = page
    await sendUpdate({ 'player1.page': page, 'player2.page': page })
  }

  const setBothActionPoints = async (value: number) => {
    crawl.value.player1.actionPoints = value
    crawl.value.player2.actionPoints = value
    await sendUpdate({ 'player1.actionPoints': value, 'player2.actionPoints': value })
  }

  const updateModifiers = async (modifiers: Crawl['modifiers']) => {
    crawl.value.modifiers = modifiers
    markPending('modifiers')
    try {
      await sendUpdate({ modifiers })
    } finally {
      unmarkPending('modifiers')
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

  const togglePowerUsed = async (powerId: string) => {
    if (!player.value) return
    const key = `${player.value}.powers`
    const currentPowers = crawl.value[player.value].powers
    const idx = currentPowers.findIndex((power) => power.id === powerId)
    if (idx === -1) return
    const newPowers = currentPowers.map((power, i) => (i === idx ? { ...power, used: !power.used } : power))
    crawl.value[player.value].powers = newPowers
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

  const setSelectedOpponentCard = async (selection: CardSelection) => {
    if (!player.value) return
    const p = player.value
    const key = `${p}.selectedOpponentCard`
    crawl.value[p].selectedOpponentCard = selection
    markPending(key)
    try {
      await sendUpdate({ [key]: selection })
    } finally {
      unmarkPending(key)
    }
  }

  const setActionPoints = async (value: number) => {
    if (!player.value) return
    const p = player.value
    const key = `${p}.actionPoints`
    crawl.value[p].actionPoints = value
    markPending(key)
    try {
      await sendUpdate({ [key]: value })
    } finally {
      unmarkPending(key)
    }
  }

  const decrementActionPoint = async () => {
    if (!player.value) return
    const p = player.value
    const key = `${p}.actionPoints`
    const next = (crawl.value[p].actionPoints ?? 2) - 1
    crawl.value[p].actionPoints = next < 0 ? 0 : next
    markPending(key)
    try {
      await sendUpdate({ [key]: next < 0 ? 0 : next })
    } finally {
      unmarkPending(key)
    }
  }

  const loadCrawl = (crawlData: Crawl & { id: string }) => {
    const { id, ...rest } = crawlData
    gameId.value = id
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
    opponent,
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
    winOpponentDuel,
    setBothPages,
    setBothActionPoints,
    updateModifiers,
    addPowerToUser,
    removePowerFromUser,
    togglePowerUsed,
    addCardToDeck,
    removeCardFromDeck,
    getCrawls,
    deleteCrawl,
    setSelectedOpponentCard,
    setActionPoints,
    decrementActionPoint,
    updatePage,
    loadCrawl,
  }
}
