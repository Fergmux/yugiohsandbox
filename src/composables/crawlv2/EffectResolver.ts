import type { GameCard, Check } from '@/types/cards'
import { Event, EventBus } from './EventBus'
import { getLocationId, locations } from '@/types/crawlv2'
import { clearBuffsFromSource, registerBuffReevaluation } from './BuffSystem'

export type Comparitors = 'equals' | 'not_equals' | 'less_than' | 'adjacent'

function getNestedValue<T extends object>(obj: T, key?: string): unknown {
  let current: unknown = obj
  if (!key) return
  for (const k of key.split('.')) {
    current = (current as Record<string, unknown>)?.[k]
  }
  return current
}

export function filterByChecks(target: Check[], card: GameCard, cards: GameCard[]): GameCard[] {
  return cards.filter((_card) => {
    return target.every((_target) => {
      switch (_target.comparitor) {
        case 'equals':
          return getNestedValue(_card, _target.key) === _target.value
        case 'adjacent':
          return card.location.adjacent?.includes(_card.location.id)
        default:
          return false
      }
    })
  })
}

export class EffectResolver {
  constructor() {}

  private findTarget(target: Check[], card: GameCard, cards: GameCard[]): GameCard[] | null {
    return filterByChecks(target, card, cards)
  }

  private makeChecks(checks: Check[] | undefined, cards: GameCard[]): boolean {
    if (!checks) return true

    return cards.some((c) => {
      return checks.every((check) => {
        switch (check.comparitor) {
          case 'equals':
            return getNestedValue(c, check.key) === check.value
          case 'not_equals':
            return getNestedValue(c, check.key) !== check.value
          case 'less_than':
            return (getNestedValue(c, check.key) as number) < (check.value as unknown as number)
          default:
            return false
        }
      })
    })
  }

  async damage({ target, source }: { target: GameCard | null; source: GameCard | null }) {
    if (!target || !source) return

    const { cancelled } = await EventBus.emit(Event.TARGETED_ATTACK, target.gameId, { target, source })
    if (cancelled) return

    if (source.atk && target.def && target.atk) {
      if (target.def <= source.atk) {
        target.location = {
          id: getLocationId('spent', 1, target.owner ?? null),
          type: 'spent',
          index: 1,
          player: target.owner ?? null,
          name: 'Spent',
        }
        EventBus.emit(Event.DAMAGE_DEALT, target.gameId, { target, source })
        EventBus.emit(Event.UNIT_DEFEATED, target.gameId, { target, source })
      }
    }
  }

  async setTrap(card: GameCard, location: GameCard['location']) {
    const { cancelled } = await EventBus.emit(Event.TRAP_SET, card.gameId, { card })
    if (cancelled) return
    card.location = location
  }

  async swapStance({ card }: { card: GameCard | null }) {
    if (!card) return
    await EventBus.emit(Event.UNIT_STANCE_SWAP, card.gameId, { card })
  }

  private registerOngoingEffects(card: GameCard, cards: GameCard[]) {
    if (!(card.effects ?? []).some((e) => e.ongoing)) return

    registerBuffReevaluation(
      card,
      () => {
        clearBuffsFromSource(card.gameId, cards)
        if (card.location.type === 'unit') this.executeCardEffects(card, cards, undefined, true)
      },
      () => clearBuffsFromSource(card.gameId, cards),
    )
  }

  async summon(card: GameCard, cards: GameCard[], location: GameCard['location']) {
    const { cancelled } = await EventBus.emit(Event.UNIT_SUMMONED, card.gameId, { card })
    if (cancelled) return
    card.location = location
    this.executeCardEffects(card, cards, Event.UNIT_SUMMONED)
    this.registerOngoingEffects(card, cards)
    EventBus.emit(Event.CARD_MOVED, card.gameId, { card })
  }

  executeCardEffects(card: GameCard, cards: GameCard[], trigger?: Event, onlyOngoing = false) {
    for (const effect of card.effects ?? []) {
      if (!onlyOngoing) {
        if (trigger !== undefined && effect.trigger !== trigger) continue
        if (trigger === undefined && effect.trigger !== undefined) continue
      }
      if (onlyOngoing && !effect.ongoing) continue
      if (effect.conditions?.some((c) => !this.makeChecks(c.checks, cards))) continue

      const target = effect.target && this.findTarget(effect.target, card, cards)

      switch (effect.effect) {
        case 'add_to_hand':
          if (!target) continue

          const openHandSlot = locations.find(
            (loc) => loc.type === 'hand' && loc.player === card.owner && !cards.some((c) => c.location.id === loc.id),
          )
          if (!openHandSlot) continue

          EventBus.emit(Event.CARD_MOVED, target[0].gameId, { target: target[0], source: card })

          target[0].location = { ...openHandSlot }
          break
        case 'damage_type':
          if (!target) continue

          target.forEach((t) => {
            t.buffs[`${card.gameId}:damage`] = effect.options?.damageType ?? ''
          })
          break
      }
    }
  }
}

export const effectResolver = new EffectResolver()
