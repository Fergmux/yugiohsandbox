import { collection, getDocs, query, where } from 'firebase/firestore'

import { db } from './firebase.js'

const ADMIN_ID = process.env.ADMIN_USER_ID ?? 'k42xZxnDK6KhbBYuEiI1'

interface AdminError {
  statusCode: number
  headers: Record<string, string>
  body: string
}

export async function requireAdmin(firebaseUid: string): Promise<{ error?: AdminError }> {
  const usersRef = collection(db, 'users')
  const userQuery = query(usersRef, where('firebaseUid', '==', firebaseUid))
  const querySnapshot = await getDocs(userQuery)
  const userDoc = querySnapshot.docs[0]

  if (!userDoc || userDoc.id !== ADMIN_ID) {
    return {
      error: {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Admin access required' }),
      },
    }
  }

  return {}
}
