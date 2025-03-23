import { client, fql } from '../lib/client.js'

const handler = async (event: { body: string }) => {
  try {
    const body = JSON.parse(event.body)

    const getUserQuery = fql`users.firstWhere(.username.toLowerCase() == ${body.username.toLowerCase()})`
    const userResponse = await client.query(getUserQuery)
    if (userResponse.data) throw new Error('User already exists')

    // Build query that uses the previous var and sub-query
    const upsertCollectionQuery = fql`users.create({
      username: ${body.username},
    })`

    // Run the query
    const response = await client.query(upsertCollectionQuery)

    return {
      statusCode: 200,
      body: JSON.stringify(response.data),
      headers: {
        'Content-Type': 'application/json',
      },
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error(err)
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: err.message }),
      }
    }
  }
}

export { handler }
