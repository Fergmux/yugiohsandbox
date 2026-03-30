import { deleteDoc, doc } from 'firebase/firestore'

import { db } from '../lib/firebase.js'
import { verifyAuth } from '../lib/auth.js'

const handler = async (event: { body: string; headers: Record<string, string> }) => {
  try {
    const authResult = await verifyAuth(event)
    if (authResult.error) return authResult.error

    const body = JSON.parse(event.body)

    if (!body.id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Crawl ID is required' }),
        headers: { 'Content-Type': 'application/json' },
      }
    }

    const crawlRef = doc(db, 'crawls', body.id)
    await deleteDoc(crawlRef)

    return {
      statusCode: 200,
      body: JSON.stringify({ id: body.id, deleted: true }),
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
