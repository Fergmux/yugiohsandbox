import { collection, getDocs } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async () => {
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
