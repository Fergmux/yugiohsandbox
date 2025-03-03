import { client, fql } from '../lib/client.js'

const handler = async (event: { path: string }) => {
  try {
    let userId
    if (!userId && event.path) {
      const pathParts = event.path.split('/')
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1]
        if (lastPart && lastPart !== 'get-user') {
          userId = decodeURIComponent(lastPart)
        }
      }
    }

    // Build query that uses the previous var and sub-query
    if (userId) {
      const updateUserQuery = fql`decks.where(.userId == ${userId})`

      // Run the query
      const response = await client.query(updateUserQuery)
      console.log(response.data)

      return {
        statusCode: 200,
        body: JSON.stringify(response.data.data),
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
