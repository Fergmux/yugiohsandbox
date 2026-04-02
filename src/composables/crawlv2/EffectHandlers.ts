import type { GameCard, EffectDef } from '@/types/cards'
import type { EventContext } from './EventBus'
import { getLocationId } from '@/types/crawlv2'
import { filterByChecks } from './EffectResolver'
import { useTargetSelector } from './useTargetSelector'

export type TriggerHandler = (
  data: unknown,
  ctx: EventContext,
  card: GameCard,
  effect: EffectDef,
  cards: GameCard[],
) => void | Promise<void>

const { selectTargets } = useTargetSelector()

export const effectHandlers: Record<string, TriggerHandler> = {
  negate_attack: (_data, ctx, card) => {
    ctx.cancel()
    card.location = {
      id: getLocationId('spent', 1, card.owner ?? null),
      type: 'spent',
      index: 1,
      player: card.owner ?? null,
      name: 'Spent',
    }
  },

  debuff: async (_data, _ctx, card, effect, cards) => {
    if (!effect.target) return

    const validTargets = filterByChecks(effect.target, card, cards)
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
}
