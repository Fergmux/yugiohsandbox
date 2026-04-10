import type { GameCard, Check, Condition, EffectDef } from '@/types/cards'
import { getGameState } from './GameState'
import {
  evaluateChecks as evaluateChecksPure,
  evaluateCondition as evaluateConditionPure,
  evaluateConditions as evaluateConditionsPure,
  filterByChecks as filterByChecksPure,
  filterByTargets as filterByTargetsPure,
  hasAvailableTargets as hasAvailableTargetsPure,
} from '@/lib/crawlv2/check-system'

// Re-export types and utilities from the shared lib
export type { Comparator } from '@/lib/crawlv2/check-system'
export { propOf } from '@/lib/crawlv2/buff-system'

/**
 * Thin wrappers that inject the current GameState singleton
 * so existing call sites don't need to change.
 */

export function evaluateChecks(checks: Check[][], source: GameCard, candidate: GameCard): boolean {
  return evaluateChecksPure(checks, source, candidate, getGameState())
}

export function filterByChecks(checks: Check[][], source: GameCard): GameCard[] {
  return filterByChecksPure(checks, source, getGameState())
}

export function filterByTargets(targets: Check[][], source: GameCard): GameCard[] {
  return filterByTargetsPure(targets, source, getGameState())
}

export function evaluateCondition(
  condition: Condition,
  source: GameCard,
  eventTarget?: GameCard,
  eventSource?: GameCard,
  triggerEffect?: EffectDef,
): boolean {
  return evaluateConditionPure(condition, source, getGameState(), eventTarget, eventSource, triggerEffect)
}

export function evaluateConditions(
  conditions: Condition[] | undefined,
  source: GameCard,
  eventTarget?: GameCard,
  eventSource?: GameCard,
  triggerEffect?: EffectDef,
): boolean {
  return evaluateConditionsPure(conditions, source, getGameState(), eventTarget, eventSource, triggerEffect)
}

export function hasAvailableTargets(card: GameCard): boolean {
  return hasAvailableTargetsPure(card, getGameState())
}
