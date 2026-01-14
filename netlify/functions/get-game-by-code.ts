import { collection, getDocs, query, where } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { path: string }) => {
  try {
    let gameCode
    if (!gameCode && event.path) {
      const pathParts = event.path.split('/')
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1]
        if (lastPart && lastPart !== 'get-game-by-code') {
          gameCode = Number(decodeURIComponent(lastPart))
        }
      }
    }

    if (gameCode === undefined || isNaN(gameCode)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Game code is required' }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    }

    const q = query(collection(db, 'games'), where('code', '==', gameCode))
    const querySnapshot = await getDocs(q)

    if (querySnapshot.docs.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Game not found' }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    }

    const gameDoc = querySnapshot.docs[0]

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

