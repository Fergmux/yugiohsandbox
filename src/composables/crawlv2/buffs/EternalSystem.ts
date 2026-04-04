import type { GameCard } from '@/types/cards'
import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

export function registerEternalSystem() {
  EventBus.on(Event.UNIT_DEFEATED, 'negate_spend', (_e, _id, data, ctx) => {
    const { target } = data as { target?: GameCard }
    if (!target) return
    if (typeof target.buffs.eternal === 'number' && target.buffs.eternal > 0) {
      ctx.cancel()
      target.buffs.eternal -= 1
      if (target.buffs.eternal <= 0) {
        delete target.buffs.eternal
      }
    }
  })

  EventBus.on(Event.TURN_START, 'eternal_system', (_e, _id, data, _ctx) => {
    const { currentPlayer } = data as { currentPlayer: string }
    const { cards } = getGameState()
    for (const card of cards) {
      if (card.owner !== currentPlayer) continue
      if (typeof card.buffs.eternal !== 'number') continue
      card.buffs.eternal -= 1
      if (card.buffs.eternal <= 0) {
        delete card.buffs.eternal
      }
    }
  })
}
