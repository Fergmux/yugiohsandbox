import type { GameCard, Check, Condition } from '@/types/cards'
import { getGameState } from './GameState'
import type { LocationKeys } from '@/types/crawlv2'
import { getEffective } from './BuffSystem'

export type Comparator =
  | 'equals'
  | 'not_equals'
  | 'less_than'
  | 'more_than'
  | 'location'
  | 'itself'
  | 'owner'
  | 'current_player'

function getNestedValue<T extends object>(obj: T, key?: string): unknown {
  if (!key) return undefined
  let current: unknown = obj
  for (const k of key.split('.')) {
    current = (current as Record<string, unknown>)?.[k]
  }
  return current
}

/** Compares two numeric values using the given comparator. */
function compareValues(comparitor: Comparator, actual: number | undefined, expected: number | undefined): boolean {
  if (actual === undefined || expected === undefined) return false
  switch (comparitor) {
    case 'equals':
      return actual === expected
    case 'more_than':
      return actual > expected
    case 'less_than':
      return actual < expected
    default:
      return false
  }
}

function evaluateCheck(check: Check, source: GameCard, candidate: GameCard): boolean {
  switch (check.comparitor) {
    case 'equals':
    case 'not_equals':
    case 'less_than':
    case 'more_than': {
      const actual = getNestedValue(getEffective(candidate), check.key) as number | undefined
      const expected = check.value as number | undefined
      const result = compareValues(check.comparitor, actual, expected)
      return check.comparitor === 'not_equals' ? !result : result
    }
    case 'location':
      return source.location[check.value as LocationKeys]?.includes(candidate.location.id) ?? false
    case 'itself':
      return candidate.gameId === source.gameId
    case 'owner':
      return check.value === 'player' ? candidate.owner === source.owner : candidate.owner !== source.owner
    case 'current_player':
      return check.value === 'player'
        ? source.owner === getGameState().currentPlayer
        : source.owner !== getGameState().currentPlayer
    default:
      return false
  }
}

/**
 * Evaluates a list of check groups against a candidate card.
 * Each group (nested array) is AND'd together, and groups are OR'd.
 * Returns true if any group's checks all pass.
 */
export function evaluateChecks(checks: Check[][], source: GameCard, candidate: GameCard): boolean {
  if (!checks.length) return true
  return checks.some((group) => group.every((check) => evaluateCheck(check, source, candidate)))
}

export function filterByChecks(checks: Check[][], source: GameCard): GameCard[] {
  return getGameState().cards.filter((c) => evaluateChecks(checks, source, c))
}

/** Returns the union of cards matching any of the provided check groups. */
export function filterByTargets(targets: Check[][], source: GameCard): GameCard[] {
  const seen = new Set<GameCard>()
  for (const checks of targets) {
    for (const card of filterByChecks([checks], source)) {
      seen.add(card)
    }
  }
  return [...seen]
}

/**
 * Evaluates a condition against the game state.
 * 'has_card': returns true if at least one card matches all checks.
 * 'event_target': returns true if the event's target card matches all checks.
 * 'event_source': returns true if the event's source card matches all checks.
 */
export function evaluateCondition(
  condition: Condition,
  source: GameCard,
  eventTarget?: GameCard,
  eventSource?: GameCard,
): boolean {
  switch (condition.test) {
    case 'event_target':
      if (!eventTarget) return false
      return evaluateChecks(condition.checks ?? [], source, eventTarget)
    case 'event_source':
      if (!eventSource) return false
      return evaluateChecks(condition.checks ?? [], source, eventSource)
    case 'has_property':
      return evaluateChecks(condition.checks ?? [], source, source)
    case 'has_energy': {
      if (!source.owner) return false
      const gs = getGameState()
      const ap = source.owner === 'player1' ? gs.player1AP : gs.player2AP
      const checks = condition.checks ?? []
      if (!checks.length) return true
      return checks.some((group) =>
        group.every((check) => {
          const threshold = getNestedValue(source, check.key) as number | undefined
          return compareValues(check.comparitor, ap, threshold)
        }),
      )
    }
    case 'has_card':
    default:
      return getGameState().cards.some((c) => evaluateChecks(condition.checks ?? [], source, c))
  }
}

export function evaluateConditions(
  conditions: Condition[] | undefined,
  source: GameCard,
  eventTarget?: GameCard,
  eventSource?: GameCard,
): boolean {
  if (!conditions) return true
  return conditions.every((c) => evaluateCondition(c, source, eventTarget, eventSource))
}

/** Strip source-card prefix from buff/debuff keys (e.g. "4:damage" -> "damage") */
export const propOf = (key: string) => key.split(':').slice(1).join(':') || key

/**
 * Checks if a card has any available targets for its manual effects.
 * Returns true if the card has no target requirements (self-targeting or no target),
 * or if there are valid targets in the game state.
 */
export function hasAvailableTargets(card: GameCard): boolean {
  const manualEffects = card.effects?.filter(
    (e) => e.trigger === 'manual' && (e.uses === undefined || (e.activations ?? 0) < e.uses),
  )

  if (!manualEffects?.length) return false

  // Check each manual effect for available targets
  for (const effect of manualEffects) {
    // If effect has no target definition, it doesn't need targets
    if (!effect.targets?.length) return true

    // Filter cards by the effect's target checks (union across all target groups)
    const validTargets = filterByTargets(effect.targets, card)
    if (validTargets.length > 0) return true
  }

  return false
}
