import type { GameCard } from '../../types/cards.js'
import type { GameState } from '../../types/crawlv2.js'

/**
 * Maps named buff/debuff keys to the card stat they modify per stack.
 */
export const BUFF_STAT_MAP: Partial<Record<string, keyof GameCard>> = {
  empower: 'atk',
  shield: 'def',
  weak: 'atk',
  expose: 'def',
}

/** Strip source-card prefix from buff/debuff keys (e.g. "4:damage" -> "damage") */
export const propOf = (key: string) => key.split(':').slice(1).join(':') || key

export function getEffective(card: GameCard): GameCard {
  if (!Object.keys(card.buffs).length && !Object.keys(card.debuffs).length) return card

  const effective = { ...card } as Record<string, unknown>

  const apply = (mods: GameCard['buffs'], sign: 1 | -1) => {
    for (const [key, value] of Object.entries(mods)) {
      const stripped = propOf(key)

      const mappedStat = BUFF_STAT_MAP[stripped] as string | undefined
      if (mappedStat && typeof value === 'number') {
        const base = effective[mappedStat]
        if (typeof base === 'number') {
          effective[mappedStat] = base + sign * value
        }
        continue
      }

      const base = effective[stripped]
      if (typeof base === 'number' && typeof value === 'number') {
        effective[stripped] = base + sign * value
      } else if (sign === 1) {
        effective[stripped] = value
      }
    }
  }

  apply(card.buffs, 1)
  apply(card.debuffs, -1)

  return effective as GameCard
}

export function clearBuffsFromSource(gs: GameState, sourceId: string) {
  const prefix = `${sourceId}:`
  for (const card of gs.cards) {
    for (const key of Object.keys(card.buffs)) {
      if (key.startsWith(prefix)) delete card.buffs[key]
    }
    for (const key of Object.keys(card.debuffs)) {
      if (key.startsWith(prefix)) delete card.debuffs[key]
    }
  }
}
