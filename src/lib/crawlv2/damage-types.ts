import type { GameCard } from '../../types/cards.js'
import { getEffective } from './buff-system.js'

export const TYPE_EFFECTIVENESS: Record<string, string[]> = {
  cosmic: ['necrotic', 'psychic', 'physical'],
  psychic: ['necrotic', 'fire'],
  necrotic: ['psychic', 'magic'],
  fire: ['physical'],
  physical: ['magic'],
  magic: ['fire'],
}

export const TYPE_MULTIPLIER = 1.5

export function getEffectiveDamageType(card: GameCard): string | undefined {
  const effective = getEffective(card)
  return (effective.damage as string | undefined) ?? card.damage
}

export function isTypeEffective(source: GameCard, target: GameCard): boolean {
  const srcType = getEffectiveDamageType(source)
  const tgtType = getEffectiveDamageType(target)
  if (!srcType || !tgtType) return false
  return TYPE_EFFECTIVENESS[srcType]?.includes(tgtType) ?? false
}

export function getTypeEffectiveAtk(source: GameCard, target: GameCard): number {
  const baseAtk = getEffective(source).atk ?? 0
  if (isTypeEffective(source, target)) {
    return Math.floor(baseAtk * TYPE_MULTIPLIER)
  }
  return baseAtk
}
