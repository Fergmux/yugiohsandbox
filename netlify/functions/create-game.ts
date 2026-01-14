import { addDoc, collection } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { body: string }) => {
  try {
    const body = JSON.parse(event.body)

    const docRef = await addDoc(collection(db, 'games'), body.gameState)

    return {
      statusCode: 200,
      body: JSON.stringify({ id: docRef.id }),
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

