import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { body: string }) => {
  try {
    const body = JSON.parse(event.body)

    if (body.username) {
      const usernameLower = body.username.toLowerCase()
      const usersRef = collection(db, 'users')
      const q = query(usersRef, where('userKey', '==', usernameLower))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty && querySnapshot.docs[0].id !== body.id) {
        throw new Error('Username already taken')
      }

      body.userKey = usernameLower
    }

    const docRef = doc(db, 'users', body.id)
    const { id, ...updateData } = body
    await updateDoc(docRef, updateData)

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
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
