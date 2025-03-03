import { client, fql } from '../lib/client.js'

const handler = async (event: { body: string }) => {
  try {
    const body = JSON.parse(event.body)
    console.log(body)

    const removeCardFromDeckQuery = fql`
      let deck = decks.firstWhere(.id == ${body.deckId})
      let cardIndex = deck?.cards.indexOf(${body.cardId}) ?? -1
      let before = deck?.cards.take(cardIndex)
      let after = deck?.cards.drop(cardIndex + 1)
      deck?.update({
        cards: before?.concat(after ?? [])
      })`

    const response = await client.query(removeCardFromDeckQuery)
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
