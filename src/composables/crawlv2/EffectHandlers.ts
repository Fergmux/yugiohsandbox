import type { GameCard, EffectDef } from '@/types/cards'
import type { EventContext } from './EventBus'
import { Event, EventBus } from './EventBus'
import { getLocationId, locations } from '@/types/crawlv2'
import { filterByChecks } from './CheckSystem'
import { useTargetSelector } from './useTargetSelector'
import { isDebuffBlocked } from './BuffSystem'
import { relocateCard } from './CardMovement'

export type TriggerHandler = (
  data: unknown,
  ctx: EventContext,
  card: GameCard,
  effect: EffectDef,
  cards: GameCard[],
) => void | Promise<void>

const { selectTargets } = useTargetSelector()

export const effectHandlers: Record<string, TriggerHandler> = {
  negate_attack: async (_data, ctx, card) => {
    ctx.cancel()
    await relocateCard(card, {
      id: getLocationId('spent', 1, card.owner ?? null),
      type: 'spent',
      index: 1,
      player: card.owner ?? null,
      name: 'Spent',
    })
  },

  debuff: async (_data, _ctx, card, effect, cards) => {
    if (!effect.target) return

    const validTargets = filterByChecks(effect.target, card, cards).filter((t) => !isDebuffBlocked(t))
    if (!validTargets.length) return

    const selected = await selectTargets(validTargets, 1)
    if (!selected.length) return

    const debuffName = String(effect.options?.debuff ?? 'unknown')
    const value = Number(effect.options?.value ?? 1)
    for (const target of selected) {
      const current = (target.debuffs[debuffName] as number) || 0
      target.debuffs[debuffName] = current + value
    }
  },

  buff: async (_data, _ctx, card, effect, cards) => {
    if (!effect.target) return

    const validTargets = filterByChecks(effect.target, card, cards)
    if (!validTargets.length) return

    const buffName = String(effect.options?.buff ?? 'unknown')
    const value = Number(effect.options?.value ?? 1)
    for (const target of validTargets) {
      const current = (target.buffs[buffName] as number) || 0
      target.buffs[buffName] = current + value
    }
  },

  add_to_hand: async (_data, _ctx, card, effect, cards) => {
    if (!effect.target) return
    const targets = filterByChecks(effect.target, card, cards)
    if (!targets.length) return

    const openHandSlot = locations.find(
      (loc) => loc.type === 'hand' && loc.player === card.owner && !cards.some((c) => c.location.id === loc.id),
    )
    if (!openHandSlot) return

    await relocateCard(targets[0], { ...openHandSlot })
  },

  damage_type: (_data, _ctx, card, effect, cards) => {
    if (!effect.target) return
    const targets = filterByChecks(effect.target, card, cards)
    for (const t of targets) {
      t.buffs[`${card.gameId}:damage`] = effect.options?.damageType ?? ''
    }
  },
}

/**
 * Cleans up all effect listeners registered for a specific card.
 * Call this when a card leaves the field to prevent stale listeners.
 */
export const cleanupEffects = (card: GameCard) => {
  for (const effect of card.effects ?? []) {
    if (effect.persistent && effect.trigger) {
      EventBus.off(effect.trigger as Event, card.gameId)
    }
    if (effect.resetOnEvent) {
      EventBus.off(effect.resetOnEvent, `reset:${card.gameId}:${effect.effect}`)
    }
  }
}
