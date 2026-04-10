import type { GameCard, Check, Condition, EffectDef } from '../../types/cards.js'
import type { GameState, LocationKeys } from '../../types/crawlv2.js'
import { getEffective } from './buff-system.js'

export type Comparator =
  | 'equals'
  | 'not_equals'
  | 'less_than'
  | 'more_than'
  | 'location'
  | 'itself'
  | 'owner'
  | 'current_player'
  | 'is_undefined'
  | 'location_check'

function getNestedValue<T extends object>(obj: T, key?: string): unknown {
  if (!key) return undefined
  let current: unknown = obj
  for (const k of key.split('.')) {
    current = (current as Record<string, unknown>)?.[k]
  }
  return current
}

function compareValues(
  comparitor: Comparator,
  actual: number | undefined,
  expected: number | undefined,
): boolean {
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

function evaluateEffectCheck(
  check: Check,
  source: GameCard,
  triggerEffect: EffectDef,
  gs: GameState,
): boolean {
  switch (check.comparitor) {
    case 'equals':
    case 'not_equals':
    case 'less_than':
    case 'more_than': {
      const actual = getNestedValue(triggerEffect, check.key) as number | undefined
      const expected = check.value as number | undefined
      const result = compareValues(check.comparitor, actual, expected)
      return check.comparitor === 'not_equals' ? !result : result
    }
    case 'current_player':
      return check.value === 'player'
        ? source.owner === gs.currentPlayer
        : source.owner !== gs.currentPlayer
    case 'is_undefined':
      return getNestedValue(triggerEffect, check.key) === undefined
    default:
      return false
  }
}

function evaluateEffectChecks(
  checks: Check[][],
  source: GameCard,
  triggerEffect: EffectDef,
  gs: GameState,
): boolean {
  return checks.some((group) =>
    group.every((check) => evaluateEffectCheck(check, source, triggerEffect, gs)),
  )
}

function evaluateCheck(check: Check, source: GameCard, candidate: GameCard, gs: GameState): boolean {
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
      return (
        source.location[check.value as LocationKeys]?.includes(candidate.location.id) ?? false
      )
    case 'itself':
      return candidate.gameId === source.gameId
    case 'owner':
      return check.value === 'player'
        ? candidate.owner === source.owner
        : candidate.owner !== source.owner
    case 'current_player':
      return check.value === 'player'
        ? source.owner === gs.currentPlayer
        : source.owner !== gs.currentPlayer
    case 'is_undefined':
      return getNestedValue(candidate, check.key) === undefined
    case 'location_check': {
      const ids = candidate.location[check.key as LocationKeys] ?? []
      const hasCard = ids.some((id) => gs.cards.some((c) => c.location.id === id))
      return check.value === 'occupied' ? hasCard : !hasCard
    }
    default:
      return false
  }
}

export function evaluateChecks(
  checks: Check[][],
  source: GameCard,
  candidate: GameCard,
  gs: GameState,
): boolean {
  if (!checks.length) return true
  return checks.some((group) =>
    group.every((check) => evaluateCheck(check, source, candidate, gs)),
  )
}

export function filterByChecks(checks: Check[][], source: GameCard, gs: GameState): GameCard[] {
  return gs.cards.filter((c) => evaluateChecks(checks, source, c, gs))
}

export function filterByTargets(targets: Check[][], source: GameCard, gs: GameState): GameCard[] {
  const seen = new Set<GameCard>()
  for (const checks of targets) {
    for (const card of filterByChecks([checks], source, gs)) {
      seen.add(card)
    }
  }
  return [...seen]
}

export function evaluateCondition(
  condition: Condition,
  source: GameCard,
  gs: GameState,
  eventTarget?: GameCard,
  eventSource?: GameCard,
  triggerEffect?: EffectDef,
): boolean {
  switch (condition.test) {
    case 'event_target':
      if (!eventTarget) return false
      return evaluateChecks(condition.checks ?? [], source, eventTarget, gs)
    case 'event_source':
      if (!eventSource) return false
      return evaluateChecks(condition.checks ?? [], source, eventSource, gs)
    case 'trigger_effect': {
      if (!triggerEffect) return false
      return evaluateEffectChecks(condition.checks ?? [], source, triggerEffect, gs)
    }
    case 'has_property':
      return evaluateChecks(condition.checks ?? [], source, source, gs)
    case 'has_energy': {
      if (!source.owner) return false
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
      return gs.cards.some((c) => evaluateChecks(condition.checks ?? [], source, c, gs))
  }
}

export function evaluateConditions(
  conditions: Condition[] | undefined,
  source: GameCard,
  gs: GameState,
  eventTarget?: GameCard,
  eventSource?: GameCard,
  triggerEffect?: EffectDef,
): boolean {
  if (!conditions) return true
  return conditions.every((c) =>
    evaluateCondition(c, source, gs, eventTarget, eventSource, triggerEffect),
  )
}

export function hasAvailableTargets(card: GameCard, gs: GameState): boolean {
  const manualEffects = card.effects?.filter(
    (e) => e.trigger === 'manual' && (e.uses === undefined || (e.activations ?? 0) < e.uses),
  )

  if (!manualEffects?.length) return false

  for (const effect of manualEffects) {
    if (!effect.targets?.length) return true
    const validTargets = filterByTargets(effect.targets, card, gs)
    if (validTargets.length > 0) return true
  }

  return false
}
