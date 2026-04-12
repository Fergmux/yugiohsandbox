import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

export function registerWeakSystem() {
  EventBus.on(Event.TURN_END, 'weak_system', (_e, _id, data, _ctx) => {
    const { currentPlayer, decrementDebuffs = true } = data as { currentPlayer: string; decrementDebuffs?: boolean }
    if (!decrementDebuffs) return
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
