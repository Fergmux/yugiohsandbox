import { doc, getDoc } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { path: string }) => {
  try {
    let gameId: string | undefined
    if (event.path) {
      const pathParts = event.path.split('/')
      const lastPart = pathParts[pathParts.length - 1]
      if (lastPart && lastPart !== 'get-game') {
        gameId = decodeURIComponent(lastPart)
      }
    }

    if (!gameId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Game ID is required' }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    }

    const gameRef = doc(db, 'games', gameId)
    const gameDoc = await getDoc(gameRef)

    if (!gameDoc.exists()) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Game not found' }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ id: gameDoc.id, ...gameDoc.data() }),
      headers: {
        'Content-Type': 'application/json',
      },
    }
  } catch (err) {
    console.error(err)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: err }),
    }
  }
}

export { handler }
