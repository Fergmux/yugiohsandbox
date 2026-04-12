import type { GameCard } from '@/types/cards'
import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

export function registerBurnSystem() {
  EventBus.on(Event.ATTACK_SUCCESSFUL, 'burn_system', async (_e, _id, data, _ctx) => {
    const { source } = data as { source: GameCard; target: GameCard }
    const burnAmount = source.debuffs.burn as number | undefined
    if (burnAmount && burnAmount > 0) {
      const { cancelled } = await EventBus.emit(Event.DAMAGE_ATTEMPTED, source.gameId, {
        player: source.owner,
        amount: 1,
      })
      if (!cancelled) {
        await EventBus.emit(Event.DAMAGE_DEALT, source.gameId, {
          player: source.owner,
          amount: 1,
        })
      }
    }
  })

  EventBus.on(Event.TURN_END, 'burn_system', (_e, _id, data, _ctx) => {
    const { currentPlayer, decrementDebuffs = true } = data as { currentPlayer: string; decrementDebuffs?: boolean }
    if (!decrementDebuffs) return
    const { cards } = getGameState()
    for (const card of cards) {
      if (card.owner !== currentPlayer) continue
      if (typeof card.debuffs.burn !== 'number') continue
      card.debuffs.burn -= 1
      if (card.debuffs.burn <= 0) {
        delete card.debuffs.burn
      }
    }
  })
}
