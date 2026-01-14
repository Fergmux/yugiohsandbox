import { collection, getDocs, query, where } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { path: string }) => {
  try {
    let name
    if (!name && event.path) {
      const pathParts = event.path.split('/')
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1]
        if (lastPart && lastPart !== 'get-user') {
          name = decodeURIComponent(lastPart)
        }
      }
    }

    if (name) {
      const usersRef = collection(db, 'users')
      const q = query(usersRef, where('username', '==', name.toLowerCase()))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) throw new Error('User not found')

      const userDoc = querySnapshot.docs[0]
      const userData = { id: userDoc.id, ...userDoc.data() }

      return {
        statusCode: 200,
        body: JSON.stringify(userData),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error(err)
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: err.message }),
      }
    }
  }
}

export { handler }
