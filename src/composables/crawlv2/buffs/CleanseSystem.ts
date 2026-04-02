import type { GameCard } from '@/types/cards'
import { Event, EventBus } from '../EventBus'

/**
 * Registers global EventBus listeners that implement cleanse buff behaviour:
 *
 *  - When CLEANSE_APPLIED event fires, remove all debuffs from the target card.
 *  - While cleanse is active (value > 0), the card cannot receive new debuffs.
 *  - At the start of each player's turn, decrement cleanse stacks on their cards.
 *  - When cleanse reaches 0, it is removed and debuffs can be applied again.
 *
 * @param getCards - A function that returns the current game cards array
 */
export function registerCleanseSystem(getCards: () => GameCard[]) {
  // When cleanse is applied, remove all debuffs from the target card
  EventBus.on(Event.CLEANSE_APPLIED, 'cleanse_system', (_e, targetId, _data, _ctx) => {
    const cards = getCards()
    const card = cards.find((c) => c.gameId === targetId)
    if (card) {
      card.debuffs = {}
    }
  })

  // Turn-start cleanse decrement: fires at the start of each player's turn
  EventBus.on(Event.TURN_START, 'cleanse_system', (_e, _id, data, _ctx) => {
    const { currentPlayer } = data as { currentPlayer: string }
    const cards = getCards()
    for (const card of cards) {
      if (card.owner !== currentPlayer) continue
      if (typeof card.buffs.cleanse !== 'number') continue
      card.buffs.cleanse -= 1
      if (card.buffs.cleanse <= 0) {
        delete card.buffs.cleanse
      }
    }
  })
}
