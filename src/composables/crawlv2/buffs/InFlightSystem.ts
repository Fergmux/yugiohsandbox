import type { GameCard } from '@/types/cards'
import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

export function registerInFlightSystem() {
  EventBus.on(Event.ATTACK_DECLARED, 'in_flight_system', (_e, _id, data, ctx) => {
    const { target } = data as { target: GameCard; source: GameCard }
    if (target && typeof target.buffs.in_flight === 'number' && target.buffs.in_flight > 0) {
      ctx.cancel()
    }
  })

  EventBus.on(Event.TURN_START, 'in_flight_system', (_e, _id, data, _ctx) => {
    const { currentPlayer } = data as { currentPlayer: string }
    const { cards } = getGameState()
    for (const card of cards) {
      if (card.owner !== currentPlayer) continue
      if (typeof card.buffs.in_flight !== 'number') continue
      card.buffs.in_flight -= 1
      if (card.buffs.in_flight <= 0) {
        delete card.buffs.in_flight
      }
    }
  })
}
