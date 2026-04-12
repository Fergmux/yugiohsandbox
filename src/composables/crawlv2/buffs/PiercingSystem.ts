import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

export function registerPiercingSystem() {
  EventBus.on(Event.TURN_START, 'piercing_system', (_e, _id, data, _ctx) => {
    const { currentPlayer, decrementBuffs = true } = data as { currentPlayer: string; decrementBuffs?: boolean }
    if (!decrementBuffs) return
    const { cards } = getGameState()
    for (const card of cards) {
      if (card.owner !== currentPlayer) continue
      if (typeof card.buffs.piercing !== 'number') continue
      card.buffs.piercing -= 1
      if (card.buffs.piercing <= 0) {
        delete card.buffs.piercing
      }
    }
  })
}
