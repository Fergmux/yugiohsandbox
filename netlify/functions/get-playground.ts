import { doc, getDoc } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { path: string }) => {
  try {
    let deckId
    if (!deckId && event.path) {
      const pathParts = event.path.split('/')
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1]
        if (lastPart && lastPart !== 'get-playground') {
          deckId = decodeURIComponent(lastPart)
        }
      }
    }

    if (deckId) {
      const docRef = doc(db, 'playgrounds', deckId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        return {
          statusCode: 404,
          body: JSON.stringify({ exists: false }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ exists: true, data: docSnap.data() }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Deck ID is required' }),
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

