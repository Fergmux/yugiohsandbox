import { addDoc, collection, getDocs, query, where } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { body: string }) => {
  try {
    const body = JSON.parse(event.body)

    const { username } = body
    const usernameLower = username.toLowerCase()

    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('userKey', '==', usernameLower))
    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) throw new Error('User already exists')

    const docRef = await addDoc(usersRef, {
      username,
      userKey: usernameLower,
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ id: docRef.id, username }),
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
