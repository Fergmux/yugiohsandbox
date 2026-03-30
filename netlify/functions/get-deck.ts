import { doc, getDoc } from 'firebase/firestore'

import { db } from '../lib/firebase.js'
import { verifyAuth } from '../lib/auth.js'

const handler = async (event: { path: string; headers: Record<string, string> }) => {
  try {
    const authResult = await verifyAuth(event)
    if (authResult.error) return authResult.error
    let deckId
    if (!deckId && event.path) {
      const pathParts = event.path.split('/')
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1]
        if (lastPart && lastPart !== 'get-deck') {
          deckId = decodeURIComponent(lastPart)
        }
      }
    }

    if (deckId) {
      const deckRef = doc(db, 'decks', deckId)
      const deckSnap = await getDoc(deckRef)

      if (!deckSnap.exists()) throw new Error('Deck not found')

      return {
        statusCode: 200,
        body: JSON.stringify({ id: deckSnap.id, ...deckSnap.data() }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
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
