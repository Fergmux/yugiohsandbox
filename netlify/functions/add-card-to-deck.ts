import { client, fql } from '../lib/client.js'

const handler = async (event: { body: string }) => {
  try {
    const body = JSON.parse(event.body)
    console.log(body)

    const addCardToDeckQuery = fql`
      let deck = decks.firstWhere(.id == ${body.deckId})
      deck?.update({
        cards: deck?.cards.append(${body.cardId})
      })`
    const response = await client.query(addCardToDeckQuery)
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
