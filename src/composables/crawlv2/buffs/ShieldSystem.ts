import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

export function registerShieldSystem() {
  EventBus.on(Event.TURN_END, 'shield_system', (_e, _id, data, _ctx) => {
    const { currentPlayer } = data as { currentPlayer: string }
    const { cards } = getGameState()
    for (const card of cards) {
      if (card.owner !== currentPlayer) continue
      if (typeof card.buffs.shield !== 'number') continue
      card.buffs.shield -= 1
      if (card.buffs.shield <= 0) {
        delete card.buffs.shield
      }
    }
  })
}
