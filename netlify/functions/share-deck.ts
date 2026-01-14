import { addDoc, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { body: string }) => {
  try {
    const body = JSON.parse(event.body)
    console.log('body', body)

    if (!body.deckId) {
      throw new Error('Deck ID is required')
    }

    if (!body.targetUsername) {
      throw new Error('Target username is required')
    }

    // Get the original deck
    const deckRef = doc(db, 'decks', body.deckId)
    const deckSnap = await getDoc(deckRef)

    if (!deckSnap.exists()) {
      throw new Error('Deck not found')
    }

    const deckData = deckSnap.data()
    console.log('deckResponse', deckData.name)

    // Get the target user
    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('username', '==', body.targetUsername.toLowerCase()))
    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      throw new Error('User not found')
    }

    const userDoc = querySnapshot.docs[0]
    console.log('userResponse', userDoc.data().username)

    // Create a new deck name with attribution if username is provided
    let deckName = deckData.name
    if (body.username) {
      deckName = `${deckData.name} (${body.username})`
    }

    // Create a new deck for the target user
    const decksRef = collection(db, 'decks')
    const newDeckRef = await addDoc(decksRef, {
      name: deckName,
      userId: userDoc.id,
      cards: deckData.cards || [],
    })

    console.log('response', newDeckRef.id)

    return {
      statusCode: 200,
      body: JSON.stringify({
        id: newDeckRef.id,
        name: deckName,
        userId: userDoc.id,
        cards: deckData.cards || [],
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    }
  } catch (err) {
    console.error(err)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: err instanceof Error ? err.message : err }),
    }
  }
}

export { handler }
