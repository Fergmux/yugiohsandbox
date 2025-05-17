import { client, fql } from '../lib/client.js'

const handler = async (event: { body: string }) => {
  try {
    const body = JSON.parse(event.body)
    console.log('body', body)
    // Validate required fields
    if (!body.deckId) {
      throw new Error('Deck ID is required')
    }

    if (!body.targetUsername) {
      throw new Error('Target username is required')
    }

    // Get the original deck
    const getDeckQuery = fql`decks.firstWhere(.id == ${body.deckId})`
    const deckResponse = await client.query(getDeckQuery)

    if (!deckResponse.data) {
      throw new Error('Deck not found')
    }
    console.log('deckResponse', deckResponse.data.name)

    // Get the target user - search case insensitively but without using toLowerCase in FQL
    const targetUsername = body.targetUsername.toLowerCase()
    const getUserQuery = fql`
      users.where(u => u.username.toLowerCase() == ${targetUsername}).first()
    `
    const userResponse = await client.query(getUserQuery)

    if (!userResponse.data) {
      throw new Error('User not found')
    }
    console.log('userResponse', userResponse.data.username)

    // Create a new deck name with attribution if username is provided
    let deckName = deckResponse.data.name
    if (body.username) {
      deckName = `${deckResponse.data.name} (${body.username})`
    }

    // Create a new deck for the target user
    const shareDeckQuery = fql`
      decks?.create({
        name: ${deckName},
        userId: ${userResponse.data.id},
        cards: ${deckResponse.data.cards}
      })`

    // Run the query
    const response = await client.query(shareDeckQuery)
    console.log('response', response.data)
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
      body: JSON.stringify({ message: err instanceof Error ? err.message : err }),
    }
  }
}

export { handler }
