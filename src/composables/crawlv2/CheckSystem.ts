import type { GameCard, Check, Condition } from '@/types/cards'

export type Comparator = 'equals' | 'not_equals' | 'less_than' | 'adjacent' | 'itself'

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
 */
export function evaluateCondition(condition: Condition, source: GameCard, cards: GameCard[]): boolean {
  switch (condition.test) {
    case 'has_card':
    default:
      return cards.some((c) => evaluateChecks(condition.checks ?? [], source, c))
  }
}

/** Strip source-card prefix from buff/debuff keys (e.g. "4:damage" -> "damage") */
export const propOf = (key: string) => key.split(':').slice(1).join(':') || key
