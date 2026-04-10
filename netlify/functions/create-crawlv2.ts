import { addDoc, collection } from 'firebase/firestore'

import { db } from '../lib/firebase.js'
import { verifyAuth } from '../lib/auth.js'

import type { CrawlV2Game } from '../../src/types/crawlv2-multiplayer.js'

const handler = async (event: { body: string; headers: Record<string, string> }) => {
  try {
    const authResult = await verifyAuth(event)
    if (authResult.error) return authResult.error

    const body = JSON.parse(event.body) as { username: string }

    const code = Math.floor(1000 + Math.random() * 9000)

    const game: CrawlV2Game = {
      _version: 0,
      code,
      status: 'lobby',
      winner: null,
      players: {
        player1: { uid: authResult.auth.uid, username: body.username },
        player2: null,
      },
      decks: {
        player1: null,
        player2: null,
      },
      gameState: {
        turn: 0,
        currentPlayer: 'player1',
        player1HP: 40,
        player2HP: 40,
        player1AP: 0,
        player2AP: 0,
        cards: [],
      },
      pendingReaction: null,
      processedActions: [],
    }

    const docRef = await addDoc(collection(db, 'crawlv2_games'), game)

    return {
      statusCode: 200,
      body: JSON.stringify({ id: docRef.id, code }),
      headers: { 'Content-Type': 'application/json' },
    }
  } catch (err) {
    console.error(err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: err }),
    }
  }
}

export { handler }
