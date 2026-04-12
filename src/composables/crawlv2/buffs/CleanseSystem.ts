import type { GameCard } from '@/types/cards'
import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

export function registerCleanseSystem() {
  EventBus.on(Event.CLEANSE_APPLIED, 'cleanse_system', (_e, targetId, _data, _ctx) => {
    const card = getGameState().cards.find((c) => c.gameId === targetId)
    if (card) {
      card.debuffs = {}
    }
  })

  EventBus.on(Event.DEBUFF_ATTEMPTED, 'cleanse_blocker', (_e, _id, data, ctx) => {
    const { target } = data as { target?: GameCard }
    if (!target) return
    if (typeof target.buffs.cleanse === 'number' && target.buffs.cleanse > 0) {
      target.buffs.cleanse -= 1
      if (target.buffs.cleanse <= 0) {
        delete target.buffs.cleanse
      }
      ctx.cancel()
    }
  })

  EventBus.on(Event.TURN_START, 'cleanse_system', (_e, _id, data, _ctx) => {
    const { currentPlayer, decrementBuffs = true } = data as { currentPlayer: string; decrementBuffs?: boolean }
    if (!decrementBuffs) return
    const { cards } = getGameState()
    for (const card of cards) {
      if (card.owner !== currentPlayer) continue
      if (typeof card.buffs.cleanse !== 'number') continue
      card.buffs.cleanse -= 1
      if (card.buffs.cleanse <= 0) {
        delete card.buffs.cleanse
      }
    }
  })
}
