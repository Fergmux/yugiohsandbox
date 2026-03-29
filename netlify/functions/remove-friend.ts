import { doc, getDoc, updateDoc } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { body: string }) => {
  try {
    const { userId, friendId } = JSON.parse(event.body)

    if (!userId || !friendId) {
      throw new Error('Missing required fields')
    }

    if (userId === friendId) {
      throw new Error('Invalid request')
    }

    const [userDoc, friendDoc] = await Promise.all([
      getDoc(doc(db, 'users', userId)),
      getDoc(doc(db, 'users', friendId)),
    ])

    if (!userDoc.exists() || !friendDoc.exists()) throw new Error('User not found')

    const userFriends = (userDoc.data().friends || []).filter((f: { id: string }) => f.id !== friendId)
    const friendFriends = (friendDoc.data().friends || []).filter((f: { id: string }) => f.id !== userId)

    await Promise.all([
      updateDoc(doc(db, 'users', userId), { friends: userFriends }),
      updateDoc(doc(db, 'users', friendId), { friends: friendFriends }),
    ])

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
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
