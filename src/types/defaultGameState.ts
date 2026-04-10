import type { GameState } from '@/types/crawlv2'
import { type Location } from '@/types/crawlv2'

import { cards, type GameCard } from './cards'

// 1: Chaos Mage
// 2: Torch Mage
// 3: Sports Mage
// 4: Dante
// 5: Tag Duo - F
// 6: Tag Duo - J
// 7	Cosmic Dragon
// 8: Captain
// 9: Blue Crystal Dragon
// 10: Fell Dragon
// 11: Cave Dragon
// 12: Lone warrior
// 13: Rage Dragon
// 14: Steadfast Knight
// 15: Flat Foot
// 19: Dragon's Wrath
// 20: Huddle Up
// 21: Book of Arcane
// 25: Spell Breaker - Unit
// 26: Spell Breaker
// 27: Magic shield

// Mage
export const defaultDeck1Ids: number[] = [1, 2, 3, 5, 6, 16, 21, 24, 25]
// Dragon
export const defaultDeckxIds: number[] = [7, 9, 10, 11, 13, 17, 19, 23, 26]
// Warrior
export const defaultDeck2Ids: number[] = [4, 8, 12, 14, 15, 18, 20, 22, 27]

export const convertToGameCard = (
  id: number,
  index: number,
  owner: 'player1' | 'player2',
  gameId: string,
): GameCard => {
  const card = cards.find((card) => card.id === id)
  if (!card) {
    throw new Error(`Card with id ${id} not found`)
  }
  return {
    ...card,
    effects: card.effects?.map((e) => ({ ...e })),
    gameId: gameId,
    faceUp: false,
    defensePosition: false,
    location: {
      id: owner === 'player1' ? 'deck1' : 'deck2',
      type: 'deck',
      index: index,
      player: owner,
      name: 'Deck',
    } as Location,
    owner: owner,
    buffs: {},
    debuffs: {},
  }
}

export const defaultDeck1: GameCard[] = defaultDeck1Ids.map((id, index) =>
  convertToGameCard(id, index, 'player1', index.toString()),
)

export const defaultDeck2: GameCard[] = defaultDeck2Ids.map((id, index) =>
  convertToGameCard(id, index, 'player2', (index + defaultDeck1.length).toString()),
)

export const defaultGameState: GameState = {
  turn: 1,
  currentPlayer: 'player1',
  player1HP: 40,
  player2HP: 40,
  player1AP: 2,
  player2AP: 2,
  cards: [...defaultDeck1, ...defaultDeck2],
}
