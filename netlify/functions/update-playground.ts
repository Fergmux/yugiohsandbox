import { doc, updateDoc } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { body: string }) => {
  try {
    const body = JSON.parse(event.body)

    if (!body.deckId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Deck ID is required' }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    }

    const docRef = doc(db, 'playgrounds', body.deckId)
    await updateDoc(docRef, body.state)

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
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

