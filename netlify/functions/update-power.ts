import { doc, updateDoc } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { body: string }) => {
  try {
    const body = JSON.parse(event.body)

    const powerRef = doc(db, 'powers', body.id)
    await updateDoc(powerRef, {
      name: body.name,
      description: body.description,
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ id: body.id, name: body.name, description: body.description }),
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
