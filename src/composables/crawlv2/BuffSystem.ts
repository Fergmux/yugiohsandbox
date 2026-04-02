import type { GameCard } from '@/types/cards'
import { Event, EventBus } from './EventBus'

// Add events here as new mechanics require buff re-evaluation.
// Note: UNIT_SUMMONED is intentionally excluded — it fires before card placement,
// so adjacency checks would see the old location. CARD_MOVED covers placement instead.
export const BUFF_REEVALUATE_EVENTS = [Event.CARD_MOVED, Event.UNIT_DEFEATED] as const satisfies readonly Event[]

export function getEffective(card: GameCard): GameCard {
  if (!Object.keys(card.buffs).length && !Object.keys(card.debuffs).length) return card

  const effective = { ...card } as Record<string, unknown>
  const propOf = (key: string) => key.split(':').slice(1).join(':') || key

  const apply = (mods: GameCard['buffs'], sign: 1 | -1) => {
    for (const [key, value] of Object.entries(mods)) {
      const prop = propOf(key)
      const base = effective[prop]
      if (typeof base === 'number' && typeof value === 'number') {
        effective[prop] = base + sign * value
      } else if (sign === 1) {
        effective[prop] = value
      }
    }
  }

  apply(card.buffs, 1)
  apply(card.debuffs, -1)

  return effective as GameCard
}

export function clearBuffsFromSource(sourceId: string, cards: GameCard[]) {
  const prefix = `${sourceId}:`
  for (const card of cards) {
    for (const key of Object.keys(card.buffs)) {
      if (key.startsWith(prefix)) delete card.buffs[key]
    }
    for (const key of Object.keys(card.debuffs)) {
      if (key.startsWith(prefix)) delete card.debuffs[key]
    }
  }
}

export function registerBuffReevaluation(sourceCard: GameCard, reapply: () => void, cleanup: () => void) {
  const listenerKey = `buff:${sourceCard.gameId}`

  const unregister = () => {
    for (const event of BUFF_REEVALUATE_EVENTS) {
      EventBus.off(event, listenerKey)
    }
  }

  for (const event of BUFF_REEVALUATE_EVENTS) {
    EventBus.on(event, listenerKey, (_e, targetId, _data, _ctx) => {
      const sourceLeft =
        (event === Event.UNIT_DEFEATED && targetId === sourceCard.gameId) ||
        (event === Event.CARD_MOVED && targetId === sourceCard.gameId && sourceCard.location.type !== 'unit')

      if (sourceLeft) {
        cleanup()
        unregister()
      } else {
        reapply()
      }
    })
  }
}
