import { collection, getDocs, query, where } from 'firebase/firestore'

import { verifyAuth } from '../lib/auth.js'
import { db } from '../lib/firebase.js'

const handler = async (event: { headers: Record<string, string> }) => {
  try {
    const authResult = await verifyAuth(event)
    if (authResult.error) return authResult.error

    const firebaseUid = authResult.auth.uid

    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('firebaseUid', '==', firebaseUid))
    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) throw new Error('User not found')

    const userDoc = querySnapshot.docs[0]
    const userData = { id: userDoc.id, ...userDoc.data() }

    return {
      statusCode: 200,
      body: JSON.stringify(userData),
      headers: { 'Content-Type': 'application/json' },
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
