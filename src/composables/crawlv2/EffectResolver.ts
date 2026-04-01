import type { GameCard, Condition } from '@/types/cards'
import { Event, EventBus } from './EventBus'
import { getLocationId, locations } from '@/types/crawlv2'

export type Effect = 'damage'
type EffectOptionsMap = {
  damage: { target: GameCard | null; source: GameCard | null }
}

export type Comparitors = 'equals' | 'not_equals' | 'less_than'

function getNestedValue<T extends object>(obj: T, key: string): unknown {
  let current: unknown = obj
  for (const k of key.split('.')) {
    current = (current as Record<string, unknown>)?.[k]
  }
  return current
}

export class EffectResolver {
  constructor() {}

  private checkCondition(conditions: Condition[] | undefined, cards: GameCard[]): boolean {
    if (!conditions) return true
    return conditions.every((condition) => {
      return cards.some((c) => {
        switch (condition.comparitor) {
          case 'equals':
            return getNestedValue(c, condition.key) === condition.value
          case 'not_equals':
            return getNestedValue(c, condition.key) !== condition.value
          case 'less_than':
            return (getNestedValue(c, condition.key) as number) < (condition.value as unknown as number)
          default:
            return false
        }
      })
    })
  }

  async damage({ target, source }: EffectOptionsMap['damage']) {
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

  executeCardEffects(card: GameCard, cards: GameCard[]) {
    for (const effect of card.effects ?? []) {
      if (!this.checkCondition(effect.conditions, cards)) continue

      if (effect.effect === 'summon_unit' && effect.targetType === 'spent_unit') {
        const spentUnit = cards.find((c) => c.location.type === 'spent' && c.location.player === card.owner)
        if (!spentUnit) continue

        const openHandSlot = locations.find(
          (loc) => loc.type === 'hand' && loc.player === card.owner && !cards.some((c) => c.location.id === loc.id),
        )
        if (!openHandSlot) continue

        spentUnit.location = { ...openHandSlot }
      }
    }
  }

  async resolve<E extends Effect>({ effect, options }: { effect: E; options: EffectOptionsMap[E] }) {
    await this[effect]({ ...options })
  }
}

export const effectResolver = new EffectResolver()
