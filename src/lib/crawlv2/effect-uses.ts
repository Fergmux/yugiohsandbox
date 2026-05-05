import type { EffectDef, GameCard } from '../../types/cards.js'

import { normalizeStatusKey } from './buff-system.js'

function getStatusStacks(record: Record<string, string | number>, status: string): number {
  return Object.entries(record).reduce(
    (total, [key, value]) => total + (normalizeStatusKey(key) === status && typeof value === 'number' ? value : 0),
    0,
  )
}

export function getAngerStacks(card: Pick<GameCard, 'buffs' | 'debuffs'>): number {
  return getStatusStacks(card.buffs, 'anger') + getStatusStacks(card.debuffs, 'anger')
}

/** Returns the effective max uses for an effect, adding anger stacks for damage effects. */
export function getEffectiveUses(
  card: Pick<GameCard, 'buffs' | 'debuffs'>,
  effect: Pick<EffectDef, 'effect' | 'uses'>,
): number | undefined {
  if (effect.uses === undefined) return undefined
  if (effect.effect !== 'damage') return effect.uses
  return effect.uses + getAngerStacks(card)
}
