import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

export function registerShieldSystem() {
  EventBus.on(Event.TURN_START, 'shield_system', (_e, _id, data, _ctx) => {
    const { currentPlayer, decrementBuffs = true } = data as { currentPlayer: string; decrementBuffs?: boolean }
    if (!decrementBuffs) return
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
