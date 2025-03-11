import { client, fql } from '../lib/client.js'

const handler = async (event: { path: string }) => {
  try {
    let name
    if (!name && event.path) {
      const pathParts = event.path.split('/')
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1]
        if (lastPart && lastPart !== 'get-user') {
          name = decodeURIComponent(lastPart)
        }
      }
    }

    console.log(name)
    if (name) {
      const getUserQuery = fql`users.firstWhere(.username == ${name})`
      const response = await client.query(getUserQuery)
      console.log(response.data)

      if (!response.data) throw new Error('User not found')

      // Variables can be used as arguments in an FQL query
      // const collectionName = 'users'

      // // Build query that uses the previous var and sub-query
      // const upsertCollectionQuery = fql`users.create({
      //   username: ${body.name},
      // })`

      // // Run the query
      // const response = await client.query(upsertCollectionQuery)
      // console.log(response.data)

      return {
        statusCode: 200,
        body: JSON.stringify(response.data),
        headers: {
          'Content-Type': 'application/json',
        },
      }
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
