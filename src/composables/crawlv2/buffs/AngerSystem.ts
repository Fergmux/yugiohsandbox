import type { EffectDef, GameCard } from '@/types/cards'
import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

/** Returns the effective max uses for an effect, adding anger stacks for damage effects. */
export function getEffectiveUses(card: GameCard, effect: EffectDef): number | undefined {
  if (effect.uses === undefined) return undefined
  if (effect.effect !== 'damage') return effect.uses
  const fromBuffs = typeof card.buffs.anger === 'number' ? card.buffs.anger : 0
  const fromDebuffs = typeof card.debuffs.anger === 'number' ? card.debuffs.anger : 0
  const anger = fromBuffs + fromDebuffs
  return effect.uses + anger
}

export function registerAngerSystem() {
  EventBus.on(Event.TURN_START, 'anger_system', (_e, _id, data, _ctx) => {
    const { currentPlayer } = data as { currentPlayer: string }
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
