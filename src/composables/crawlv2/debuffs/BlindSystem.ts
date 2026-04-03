import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

export function registerBlindSystem() {
  EventBus.on(Event.TURN_END, 'blind_system', (_e, _id, data, _ctx) => {
    const { currentPlayer } = data as { currentPlayer: string }
    const { cards } = getGameState()
    for (const card of cards) {
      if (card.owner !== currentPlayer) continue
      if (typeof card.debuffs.blind !== 'number') continue
      card.debuffs.blind -= 1
      if (card.debuffs.blind <= 0) {
        delete card.debuffs.blind
      }
    }
  })
}
