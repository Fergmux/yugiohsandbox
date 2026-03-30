import { collection, doc, getDocs, query, runTransaction, where } from 'firebase/firestore'

import { verifyAuth } from '../lib/auth.js'
import { db } from '../lib/firebase.js'

const handler = async (event: { body: string; headers: Record<string, string> }) => {
  try {
    const authResult = await verifyAuth(event)
    if (authResult.error) return authResult.error

    const body = JSON.parse(event.body)
    const { username, email } = body
    const firebaseUid = authResult.auth.uid

    // Check UID not already linked to another account
    const usersRef = collection(db, 'users')
    const uidQuery = query(usersRef, where('firebaseUid', '==', firebaseUid))
    const uidSnapshot = await getDocs(uidQuery)
    if (!uidSnapshot.empty) throw new Error('This Firebase account is already linked to a user')

    // Find the existing user by username
    const usernameLower = username.toLowerCase()
    const usernameQuery = query(usersRef, where('userKey', '==', usernameLower))
    const usernameSnapshot = await getDocs(usernameQuery)
    if (usernameSnapshot.empty) throw new Error('User not found')

    const userDoc = usernameSnapshot.docs[0]
    const userData = userDoc.data()

    if (userData.firebaseUid) throw new Error('This account has already been claimed')

    // Use a transaction to prevent race conditions
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, 'users', userDoc.id)
      const freshDoc = await transaction.get(docRef)
      const freshData = freshDoc.data()

      if (freshData?.firebaseUid) throw new Error('This account has already been claimed')

      transaction.update(docRef, { firebaseUid, email })
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ id: userDoc.id, ...userData, firebaseUid, email }),
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
