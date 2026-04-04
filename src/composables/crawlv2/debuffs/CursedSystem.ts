import type { GameCard } from '@/types/cards'
import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

export function registerCursedSystem() {
  EventBus.on(Event.CURSED_APPLIED, 'cursed_system', (_e, targetId, _data, _ctx) => {
    const card = getGameState().cards.find((c) => c.gameId === targetId)
    if (card) {
      card.buffs = {}
    }
  })

  EventBus.on(Event.BUFF_ATTEMPTED, 'cursed_blocker', (_e, _id, data, ctx) => {
    const { target } = data as { target?: GameCard }
    if (!target) return
    if (typeof target.debuffs.cursed === 'number' && target.debuffs.cursed > 0) {
      target.debuffs.cursed -= 1
      if (target.debuffs.cursed <= 0) {
        delete target.debuffs.cursed
      }
      ctx.cancel()
    }
  })

  EventBus.on(Event.TURN_START, 'cursed_system', (_e, _id, data, _ctx) => {
    const { currentPlayer } = data as { currentPlayer: string }
    const { cards } = getGameState()
    for (const card of cards) {
      if (card.owner !== currentPlayer) continue
      if (typeof card.debuffs.cursed !== 'number') continue
      card.debuffs.cursed -= 1
      if (card.debuffs.cursed <= 0) {
        delete card.debuffs.cursed
      }
    }
  })
}
