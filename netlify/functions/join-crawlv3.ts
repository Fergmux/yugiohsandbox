import { collection, doc, getDoc, getDocs, query, runTransaction, where } from 'firebase/firestore'

import { db } from '../lib/firebase.js'
import { verifyAuth } from '../lib/auth.js'

interface Crawlv3PlayerInfo {
  uid: string
  username: string
  lifePoints: number
  actionPoints: number
}

interface Crawlv3CatalogConfig {
  defaultLifePoints: number
  defaultActionPoints: number
}

interface Crawlv3Game {
  _version: number
  code: number | null
  status: 'lobby' | 'active'
  config: Crawlv3CatalogConfig
  players: {
    player1: Crawlv3PlayerInfo | null
    player2: Crawlv3PlayerInfo | null
  }
}

function sanitizeConfig(config: Crawlv3CatalogConfig | undefined): Crawlv3CatalogConfig {
  return {
    defaultLifePoints: Number.isFinite(config?.defaultLifePoints) ? Number(config?.defaultLifePoints) : 8000,
    defaultActionPoints: Number.isFinite(config?.defaultActionPoints) ? Number(config?.defaultActionPoints) : 0,
  }
}

const handler = async (event: { body: string; headers: Record<string, string> }) => {
  try {
    const authResult = await verifyAuth(event)
    if (authResult.error) return authResult.error

    const body = JSON.parse(event.body) as { code: number; username: string }
    const code = Number(body.code)

    if (!Number.isInteger(code)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'A valid room code is required' }),
      }
    }

    const querySnapshot = await getDocs(query(collection(db, 'crawlv3_games'), where('code', '==', code)))
    if (querySnapshot.empty) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Game not found' }),
      }
    }

    const gameDoc = querySnapshot.docs[0]
    const game = gameDoc.data() as Crawlv3Game
    game.config = sanitizeConfig(game.config)

    if (game.players.player1?.uid === authResult.auth.uid || game.players.player2?.uid === authResult.auth.uid) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: gameDoc.id, ...game }),
      }
    }

    if (game.status !== 'lobby') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Game already started' }),
      }
    }

    if (game.players.player2) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Game is full' }),
      }
    }

    const docRef = doc(db, 'crawlv3_games', gameDoc.id)

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(docRef)
      const current = snapshot.data() as Crawlv3Game | undefined

      if (!current) {
        throw new Error('Game not found')
      }
      current.config = sanitizeConfig(current.config)

      if (current.status !== 'lobby') {
        throw new Error('Game already started')
      }
      if (current.players.player2) {
        throw new Error('Game is full')
      }

      transaction.update(docRef, {
        'players.player2': {
          uid: authResult.auth.uid,
          username: body.username,
          lifePoints: current.config.defaultLifePoints,
          actionPoints: current.config.defaultActionPoints,
        },
        _version: (current._version ?? 0) + 1,
      })
    })

    const updatedSnapshot = await getDoc(docRef)
    const updatedGame = updatedSnapshot.data()

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: gameDoc.id, ...updatedGame }),
    }
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : String(err)
    const statusCode = ['Game is full', 'Game already started'].includes(message)
      ? 400
      : message === 'Game not found'
        ? 404
        : 500

    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }
  }
}

export { handler }
