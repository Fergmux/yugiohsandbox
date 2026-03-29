import { collection, endAt, getDocs, limit, orderBy, query, startAt } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { queryStringParameters?: Record<string, string> }) => {
  try {
    const term = event.queryStringParameters?.term?.toLowerCase()?.trim()

    if (!term) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Search term is required' }),
      }
    }

    const usersRef = collection(db, 'users')
    const q = query(usersRef, orderBy('userKey'), startAt(term), endAt(term + '\uf8ff'), limit(8))
    const querySnapshot = await getDocs(q)

    const users = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      username: doc.data().username as string,
    }))

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(users),
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error(err)
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: err.message }),
      }
    }
  }
}

export { handler }
