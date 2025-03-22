import { client, fql } from '../lib/client.js'

const handler = async (event: { path: string }) => {
  try {
    let deckId
    if (!deckId && event.path) {
      const pathParts = event.path.split('/')
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1]
        if (lastPart && lastPart !== 'get-user') {
          deckId = decodeURIComponent(lastPart)
        }
      }
    }

    // Build query that uses the previous var and sub-query
    if (deckId) {
      const updateUserQuery = fql`decks.firstWhere(.id == ${deckId})`

      // Run the query
      const response = await client.query(updateUserQuery)

      return {
        statusCode: 200,
        body: JSON.stringify(response.data),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    }
  } catch (err) {
    console.error(err)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: err }),
    }
  }
}

export { handler }
