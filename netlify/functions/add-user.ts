import { addDoc, collection, getDocs, query, where } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { body: string }) => {
  try {
    const body = JSON.parse(event.body)

    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('username', '==', body.username.toLowerCase()))
    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) throw new Error('User already exists')

    const docRef = await addDoc(usersRef, {
      username: body.username.toLowerCase(),
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ id: docRef.id, username: body.username }),
      headers: {
        'Content-Type': 'application/json',
      },
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
