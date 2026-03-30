import { collection, getDocs } from 'firebase/firestore'

import { db } from '../lib/firebase.js'
import { verifyAuth } from '../lib/auth.js'

const handler = async (event: { headers: Record<string, string> }) => {
  const authResult = await verifyAuth(event)
  if (authResult.error) return authResult.error

  const powersRef = collection(db, 'powers')
  const querySnapshot = await getDocs(powersRef)
  const powers = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  return {
    statusCode: 200,
    body: JSON.stringify(powers),
    headers: {
      'Content-Type': 'application/json',
    },
  }
}

export { handler }
