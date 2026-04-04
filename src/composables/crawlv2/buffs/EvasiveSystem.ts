import type { GameCard } from '@/types/cards'
import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

export function registerEvasiveSystem() {
  EventBus.on(Event.ATTACK_DECLARED, 'evasive_system', (_e, _id, data, ctx) => {
    const { target } = data as { target: GameCard; source: GameCard }
    if (target && typeof target.buffs.evasive === 'number' && target.buffs.evasive > 0) {
      ctx.cancel()
    }
  })

  EventBus.on(Event.TURN_START, 'evasive_system', (_e, _id, data, _ctx) => {
    const { currentPlayer } = data as { currentPlayer: string }
    const { cards } = getGameState()
    for (const card of cards) {
      if (card.owner !== currentPlayer) continue
      if (typeof card.buffs.evasive !== 'number') continue
      card.buffs.evasive -= 1
      if (card.buffs.evasive <= 0) {
        delete card.buffs.evasive
      }
    }
  })
}
