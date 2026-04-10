import { collection, getDocs, query, where, doc, runTransaction } from 'firebase/firestore'

import { db } from '../lib/firebase.js'
import { verifyAuth } from '../lib/auth.js'

const handler = async (event: { body: string; headers: Record<string, string> }) => {
  try {
    const authResult = await verifyAuth(event)
    if (authResult.error) return authResult.error

    const body = JSON.parse(event.body) as { code: number; username: string }

    const q = query(
      collection(db, 'crawlv2_games'),
      where('code', '==', body.code),
      where('status', '==', 'lobby'),
    )
    const querySnapshot = await getDocs(q)

    if (querySnapshot.docs.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Game not found' }),
        headers: { 'Content-Type': 'application/json' },
      }
    }

    const gameDoc = querySnapshot.docs[0]
    const gameData = gameDoc.data()

    if (gameData.players.player1?.uid === authResult.auth.uid) {
      return {
        statusCode: 200,
        body: JSON.stringify({ id: gameDoc.id, ...gameData }),
        headers: { 'Content-Type': 'application/json' },
      }
    }

    if (gameData.players.player2 !== null) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Game is full' }),
        headers: { 'Content-Type': 'application/json' },
      }
    }

    const docRef = doc(db, 'crawlv2_games', gameDoc.id)

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef)
      const current = snap.data()!

      if (current.players.player2 !== null) {
        throw new Error('Game is full')
      }

      transaction.update(docRef, {
        'players.player2': { uid: authResult.auth.uid, username: body.username },
        _version: (current._version ?? 0) + 1,
      })
    })

    const updatedSnap = await getDocs(
      query(collection(db, 'crawlv2_games'), where('code', '==', body.code)),
    )
    const updatedData = updatedSnap.docs[0]

    return {
      statusCode: 200,
      body: JSON.stringify({ id: updatedData.id, ...updatedData.data() }),
      headers: { 'Content-Type': 'application/json' },
    }
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : String(err)
    return {
      statusCode: message === 'Game is full' ? 400 : 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }
  }
}

export { handler }
