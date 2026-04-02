import type { GameCard, Check, Condition } from '@/types/cards'

export type Comparator = 'equals' | 'not_equals' | 'less_than' | 'adjacent' | 'itself' | 'owner'

function getNestedValue<T extends object>(obj: T, key?: string): unknown {
  if (!key) return undefined
  let current: unknown = obj
  for (const k of key.split('.')) {
    current = (current as Record<string, unknown>)?.[k]
  }
  return current
}

function evaluateCheck(check: Check, source: GameCard, candidate: GameCard): boolean {
  switch (check.comparitor) {
    case 'equals':
      return getNestedValue(candidate, check.key) === check.value
    case 'not_equals':
      return getNestedValue(candidate, check.key) !== check.value
    case 'less_than':
      return (getNestedValue(candidate, check.key) as number) < (check.value as unknown as number)
    case 'adjacent':
      return source.location.adjacent?.includes(candidate.location.id) ?? false
    case 'itself':
      return candidate.gameId === source.gameId
    case 'owner':
      return check.value === 'player' ? candidate.owner === source.owner : candidate.owner !== source.owner
    default:
      return false
  }
}

/**
 * Evaluates a list of checks against a candidate card, respecting combinators.
 * First check has no combinator (implicit start). Subsequent checks use
 * 'and' (default) or 'or'. Evaluated left-to-right with no precedence grouping.
 */
export function evaluateChecks(checks: Check[], source: GameCard, candidate: GameCard): boolean {
  if (!checks.length) return true
  let result = evaluateCheck(checks[0], source, candidate)
  for (let i = 1; i < checks.length; i++) {
    const check = checks[i]
    const value = evaluateCheck(check, source, candidate)
    if (check.combinator === 'or') {
      result = result || value
    } else {
      result = result && value
    }
  }
  return result
}

export function filterByChecks(checks: Check[], source: GameCard, cards: GameCard[]): GameCard[] {
  return cards.filter((c) => evaluateChecks(checks, source, c))
}

/**
 * Evaluates a condition against the game state.
 * 'has_card': returns true if at least one card matches all checks.
 * 'event_target': returns true if the event's target card matches all checks.
 */
export function evaluateCondition(
  condition: Condition,
  source: GameCard,
  cards: GameCard[],
  eventTarget?: GameCard,
): boolean {
  switch (condition.test) {
    case 'event_target':
      if (!eventTarget) return false
      return evaluateChecks(condition.checks ?? [], source, eventTarget)
    case 'has_card':
    default:
      return cards.some((c) => evaluateChecks(condition.checks ?? [], source, c))
  }
}

export function evaluateConditions(
  conditions: Condition[] | undefined,
  source: GameCard,
  cards: GameCard[],
  eventTarget?: GameCard,
): boolean {
  if (!conditions) return true
  return conditions.every((c) => evaluateCondition(c, source, cards, eventTarget))
}

/** Strip source-card prefix from buff/debuff keys (e.g. "4:damage" -> "damage") */
export const propOf = (key: string) => key.split(':').slice(1).join(':') || key

/**
 * Checks if a card has any available targets for its manual effects.
 * Returns true if the card has no target requirements (self-targeting or no target),
 * or if there are valid targets in the game state.
 */
export function hasAvailableTargets(card: GameCard, cards: GameCard[]): boolean {
  const manualEffects = card.effects?.filter(
    (e) => e.trigger === 'manual' && (e.uses === undefined || (e.activations ?? 0) < e.uses),
  )

  if (!manualEffects?.length) return false

  // Check each manual effect for available targets
  for (const effect of manualEffects) {
    // If effect has no target definition, it doesn't need targets
    if (!effect.target) return true

    // Filter cards by the effect's target checks
    const validTargets = filterByChecks(effect.target, card, cards)
    if (validTargets.length > 0) return true
  }

  return false
}
