import { arrayUnion, doc, getDoc, updateDoc } from 'firebase/firestore'

import { db } from '../lib/firebase.js'
import { verifyAuth } from '../lib/auth.js'

const handler = async (event: { body: string; headers: Record<string, string> }) => {
  try {
    const authResult = await verifyAuth(event)
    if (authResult.error) return authResult.error
    const { invite } = JSON.parse(event.body)

    if (!invite?.id || !invite?.userIdFrom || !invite?.userIdTo) {
      throw new Error('Missing required fields')
    }

    const [fromDoc, toDoc] = await Promise.all([
      getDoc(doc(db, 'users', invite.userIdFrom)),
      getDoc(doc(db, 'users', invite.userIdTo)),
    ])

    if (!fromDoc.exists() || !toDoc.exists()) throw new Error('User not found')

    const fromData = fromDoc.data()
    const toData = toDoc.data()

    const fromInvites = (fromData.invites || []).filter((inv: { id: string }) => inv.id !== invite.id)
    const toInvites = (toData.invites || []).filter((inv: { id: string }) => inv.id !== invite.id)

    const friendForFrom = { id: invite.userIdTo, username: invite.usernameTo }
    const friendForTo = { id: invite.userIdFrom, username: invite.usernameFrom }

    await Promise.all([
      updateDoc(doc(db, 'users', invite.userIdFrom), {
        invites: fromInvites,
        friends: arrayUnion(friendForFrom),
      }),
      updateDoc(doc(db, 'users', invite.userIdTo), {
        invites: toInvites,
        friends: arrayUnion(friendForTo),
      }),
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
