import { addDoc, collection } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { body: string }) => {
  try {
    const body = JSON.parse(event.body)

    const decksRef = collection(db, 'decks')
    const docRef = await addDoc(decksRef, {
      name: body.deckName,
      userId: body.userId,
      cards: [],
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ id: docRef.id, name: body.deckName, userId: body.userId, cards: [] }),
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
