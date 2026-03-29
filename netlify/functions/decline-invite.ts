import { doc, getDoc, updateDoc } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { body: string }) => {
  try {
    const { invite } = JSON.parse(event.body)

    if (!invite?.id || !invite?.userIdFrom || !invite?.userIdTo) {
      throw new Error('Missing required fields')
    }

    const [fromDoc, toDoc] = await Promise.all([
      getDoc(doc(db, 'users', invite.userIdFrom)),
      getDoc(doc(db, 'users', invite.userIdTo)),
    ])

    if (!fromDoc.exists() || !toDoc.exists()) throw new Error('User not found')

    const fromInvites = (fromDoc.data().invites || []).filter((inv: { id: string }) => inv.id !== invite.id)
    const toInvites = (toDoc.data().invites || []).filter((inv: { id: string }) => inv.id !== invite.id)

    await Promise.all([
      updateDoc(doc(db, 'users', invite.userIdFrom), { invites: fromInvites }),
      updateDoc(doc(db, 'users', invite.userIdTo), { invites: toInvites }),
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
