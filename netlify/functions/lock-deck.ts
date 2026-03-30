import { doc, updateDoc } from 'firebase/firestore'

import { db } from '../lib/firebase.js'
import { verifyAuth } from '../lib/auth.js'

const handler = async (event: { body: string; headers: Record<string, string> }) => {
  try {
    const authResult = await verifyAuth(event)
    if (authResult.error) return authResult.error

    const body = JSON.parse(event.body)

    const deckRef = doc(db, 'decks', body.deckId)
    await updateDoc(deckRef, {
      locked: true,
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ id: body.deckId, locked: true }),
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
