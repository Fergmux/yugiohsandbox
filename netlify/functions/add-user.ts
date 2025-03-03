import { client, fql } from '../lib/client.js'

const handler = async (event: { body: string }) => {
  try {
    const body = JSON.parse(event.body)
    console.log(body)

    // Build query that uses the previous var and sub-query
    const upsertCollectionQuery = fql`users.create({
      username: ${body.username},
    })`

    // Run the query
    const response = await client.query(upsertCollectionQuery)
    console.log(response.data)

    return {
      statusCode: 200,
      body: JSON.stringify(response.data),
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
      body: JSON.stringify({ message: err }),
    }
  }
}

export { handler }
