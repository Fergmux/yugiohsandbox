import { addDoc, collection, getDocs, query, where } from 'firebase/firestore'

import { verifyAuth } from '../lib/auth.js'
import { db } from '../lib/firebase.js'

const handler = async (event: { body: string; headers: Record<string, string> }) => {
  try {
    const authResult = await verifyAuth(event)
    if (authResult.error) return authResult.error

    const body = JSON.parse(event.body)
    const { username, email } = body
    const firebaseUid = authResult.auth.uid
    const usernameLower = username.toLowerCase()

    const usersRef = collection(db, 'users')

    // Check username uniqueness
    const usernameQuery = query(usersRef, where('userKey', '==', usernameLower))
    const usernameSnapshot = await getDocs(usernameQuery)
    if (!usernameSnapshot.empty) throw new Error('Username already taken')

    // Check UID not already linked
    const uidQuery = query(usersRef, where('firebaseUid', '==', firebaseUid))
    const uidSnapshot = await getDocs(uidQuery)
    if (!uidSnapshot.empty) throw new Error('Account already registered')

    const docRef = await addDoc(usersRef, {
      username,
      userKey: usernameLower,
      firebaseUid,
      email,
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ id: docRef.id, username, firebaseUid, email }),
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
