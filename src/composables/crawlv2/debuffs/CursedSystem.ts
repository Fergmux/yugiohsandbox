import type { GameCard } from '@/types/cards'
import { normalizeStatusKey, propOf } from '../BuffSystem'
import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

function consumeCursedStack(record: Record<string, string | number>): boolean {
  for (const [key, value] of Object.entries(record)) {
    if (normalizeStatusKey(key) !== 'cursed') continue
    if (typeof value !== 'number' || value <= 0) continue

    const nextValue = value - 1
    if (nextValue > 0) record[key] = nextValue
    else delete record[key]
    return true
  }

  return false
}

export function registerCursedSystem() {
  EventBus.on(Event.CURSED_APPLIED, 'cursed_system', (_e, targetId, _data, _ctx) => {
    const card = getGameState().cards.find((c) => c.gameId === targetId)
    if (card) {
      card.buffs = {}
      card.debuffs = Object.fromEntries(Object.entries(card.debuffs).filter(([key]) => propOf(key) === 'cursed'))
    }
  })

  EventBus.on(Event.BUFF_ATTEMPTED, 'cursed_blocker', (_e, _id, data, ctx) => {
    const { target } = data as { target?: GameCard }
    if (!target) return
    if (consumeCursedStack(target.debuffs)) {
      ctx.cancel()
    }
  })

  EventBus.on(Event.TURN_END, 'cursed_system', (_e, _id, data, _ctx) => {
    const { currentPlayer, decrementDebuffs = true } = data as { currentPlayer: string; decrementDebuffs?: boolean }
    if (!decrementDebuffs) return
    const { cards } = getGameState()
    for (const card of cards) {
      if (card.owner !== currentPlayer) continue
      consumeCursedStack(card.debuffs)
    }
  })
}
