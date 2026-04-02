import type { GameCard } from '@/types/cards'
import { Event, EventBus } from './EventBus'
import { propOf } from './CheckSystem'
import { registerBurnSystem } from './debuffs/BurnSystem'
import { registerCleanseSystem } from './buffs/CleanseSystem'

// Add events here as new mechanics require buff re-evaluation.
// Note: UNIT_SUMMONED is intentionally excluded — it fires before card placement,
// so adjacency checks would see the old location. CARD_MOVED covers placement instead.
export const BUFF_REEVALUATE_EVENTS = [Event.CARD_MOVED, Event.UNIT_DEFEATED] as const satisfies readonly Event[]

export function getEffective(card: GameCard): GameCard {
  if (!Object.keys(card.buffs).length && !Object.keys(card.debuffs).length) return card

  const effective = { ...card } as Record<string, unknown>

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

/**
 * Returns true if the card has an active cleanse buff (value > 0).
 * Cards with cleanse cannot receive new debuffs.
 */
export function isDebuffBlocked(card: GameCard): boolean {
  return typeof card.buffs.cleanse === 'number' && card.buffs.cleanse > 0
}

/**
 * Registers all buff/debuff systems (burn, cleanse) with the provided card getter.
 * Call once during app setup — subsequent calls are safe because EventBus.on
 * appends to the listener array for the same (event, key) pair.
 *
 * @param getCards - A function that returns the current game cards array
 */
export function registerBuffSystems(getCards: () => GameCard[]) {
  registerBurnSystem(getCards)
  registerCleanseSystem(getCards)
}
