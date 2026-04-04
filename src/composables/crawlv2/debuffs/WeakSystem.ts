import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

export function registerWeakSystem() {
  EventBus.on(Event.TURN_START, 'weak_system', (_e, _id, data, _ctx) => {
    const { currentPlayer } = data as { currentPlayer: string }
    const { cards } = getGameState()
    for (const card of cards) {
      if (card.owner !== currentPlayer) continue
      if (typeof card.debuffs.weak !== 'number') continue
      card.debuffs.weak -= 1
      if (card.debuffs.weak <= 0) {
        delete card.debuffs.weak
      }
    }
  })
}
