import { collection, getDocs, query, where } from 'firebase/firestore'

import { db } from '../lib/firebase.js'

const handler = async (event: { path: string }) => {
  try {
    let userId
    if (event.path) {
      const pathParts = event.path.split('/')
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1]
        if (lastPart && lastPart !== 'get-crawls') {
          userId = decodeURIComponent(lastPart)
        }
      }
    }

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'User ID is required' }),
        headers: { 'Content-Type': 'application/json' },
      }
    }

    const crawlsRef = collection(db, 'crawls')

    const [player1Snapshot, player2Snapshot] = await Promise.all([
      getDocs(query(crawlsRef, where('player1.id', '==', userId))),
      getDocs(query(crawlsRef, where('player2.id', '==', userId))),
    ])

    const seen = new Set<string>()
    const crawls = [...player1Snapshot.docs, ...player2Snapshot.docs]
      .filter((doc) => {
        if (seen.has(doc.id)) return false
        seen.add(doc.id)
        return true
      })
      .map((doc) => ({ id: doc.id, ...doc.data() }))

    return {
      statusCode: 200,
      body: JSON.stringify(crawls),
      headers: { 'Content-Type': 'application/json' },
    }
  } catch (err) {
    console.error(err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: err }),
    }
  }
}

export { handler }
