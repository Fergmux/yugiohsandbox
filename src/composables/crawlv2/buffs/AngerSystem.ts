import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

export { getEffectiveUses } from '@/lib/crawlv2/effect-uses'

export function registerAngerSystem() {
  EventBus.on(Event.TURN_START, 'anger_system', (_e, _id, data, _ctx) => {
    const { currentPlayer, decrementBuffs = true } = data as { currentPlayer: string; decrementBuffs?: boolean }
    if (!decrementBuffs) return
    const { cards } = getGameState()
    for (const card of cards) {
      if (card.owner !== currentPlayer) continue
      if (typeof card.buffs.anger === 'number') {
        card.buffs.anger -= 1
        if (card.buffs.anger <= 0) delete card.buffs.anger
      }
    }
  })
}
