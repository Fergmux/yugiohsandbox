import { arrayUnion, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { body: string }) => {
  try {
    const { senderId, senderUsername, recipientUsername, type, gameCode } = JSON.parse(event.body)

    if (!senderId || !senderUsername || !recipientUsername || !type) {
      throw new Error('Missing required fields')
    }

    if (senderUsername.toLowerCase() === recipientUsername.toLowerCase()) {
      throw new Error('Cannot send an invite to yourself')
    }

    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('userKey', '==', recipientUsername.toLowerCase()))
    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) throw new Error('User not found')

    const recipientDoc = querySnapshot.docs[0]
    const recipientData = recipientDoc.data()

    const existingInvites = recipientData.invites || []
    const alreadyInvited = existingInvites.some(
      (inv: { userIdFrom: string; type: string }) => inv.userIdFrom === senderId && inv.type === type,
    )
    if (alreadyInvited) throw new Error('Invite already sent')

    const invite = {
      id: `${senderId}-${recipientDoc.id}-${Date.now()}`,
      usernameFrom: senderUsername,
      userIdFrom: senderId,
      usernameTo: recipientData.username,
      userIdTo: recipientDoc.id,
      created: new Date().toISOString(),
      gameCode: gameCode || null,
      type,
    }

    await Promise.all([
      updateDoc(doc(db, 'users', senderId), { invites: arrayUnion(invite) }),
      updateDoc(doc(db, 'users', recipientDoc.id), { invites: arrayUnion(invite) }),
    ])

    return {
      statusCode: 200,
      body: JSON.stringify(invite),
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
