import { deleteDoc, doc } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { body: string }) => {
  try {
    const body = JSON.parse(event.body)

    const powerRef = doc(db, 'powers', body.id)
    await deleteDoc(powerRef)

    return {
      statusCode: 200,
      body: JSON.stringify({ id: body.id, deleted: true }),
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
