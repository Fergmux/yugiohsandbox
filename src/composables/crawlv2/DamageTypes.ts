import type { GameCard } from '@/types/cards'
import { getEffective } from './BuffSystem'

/**
 * Maps each damage type to the types it is effective against (1.5x ATK).
 */
export const TYPE_EFFECTIVENESS: Record<string, string[]> = {
  cosmic: ['necrotic', 'psychic', 'physical'],
  psychic: ['necrotic', 'fire'],
  necrotic: ['psychic', 'magic'],
  fire: ['physical'],
  physical: ['magic'],
  magic: ['fire'],
}

export const TYPE_MULTIPLIER = 1.5

/**
 * Returns the effective damage type for a card (buffs can override base damage type).
 */
export function getEffectiveDamageType(card: GameCard): string | undefined {
  const effective = getEffective(card)
  return (effective.damage as string | undefined) ?? card.damage
}

/**
 * Returns true if the source's damage type is effective against the target's damage type.
 */
export function isTypeEffective(source: GameCard, target: GameCard): boolean {
  const srcType = getEffectiveDamageType(source)
  const tgtType = getEffectiveDamageType(target)
  if (!srcType || !tgtType) return false
  return TYPE_EFFECTIVENESS[srcType]?.includes(tgtType) ?? false
}

/**
 * Returns the effective ATK of source when attacking target, accounting for type advantage.
 */
export function getTypeEffectiveAtk(source: GameCard, target: GameCard): number {
  const baseAtk = getEffective(source).atk ?? 0
  if (isTypeEffective(source, target)) {
    return Math.floor(baseAtk * TYPE_MULTIPLIER)
  }
  return baseAtk
}
