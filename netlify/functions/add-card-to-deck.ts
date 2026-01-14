import { doc, updateDoc } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { body: string }) => {
  try {
    const body = JSON.parse(event.body)

    const deckRef = doc(db, 'decks', body.deckId)
    await updateDoc(deckRef, {
      cards: body.cards,
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ id: body.deckId, cards: body.cards }),
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
