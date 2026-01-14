import { collection, getDocs, query, where } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { path: string }) => {
  try {
    let userId
    if (!userId && event.path) {
      const pathParts = event.path.split('/')
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1]
        if (lastPart && lastPart !== 'get-decks') {
          userId = decodeURIComponent(lastPart)
        }
      }
    }

    if (userId) {
      const decksRef = collection(db, 'decks')
      const q = query(decksRef, where('userId', '==', userId))
      const querySnapshot = await getDocs(q)

      const decks = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      return {
        statusCode: 200,
        body: JSON.stringify(decks),
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
