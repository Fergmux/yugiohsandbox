import type { GameCard } from '@/types/cards'
import type { EventContext } from './EventBus'
import { getLocationId } from '@/types/crawlv2'

type TriggerHandler = (data: unknown, ctx: EventContext, card: GameCard) => void

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
}
