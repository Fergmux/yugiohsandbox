import type { GameCard } from '@/types/cards'
import { Event, EventBus } from './EventBus'

/**
 * Registers global EventBus listeners that implement burn debuff behaviour:
 *
 *  - When a burnt unit attacks, emit PLAYER_DAMAGE (1 damage) to the owning player.
 *  - At the end of the owning player's turn, decrement all their cards' burn stacks by 1
 *    and remove the debuff when it reaches 0.
 *
 * Call once during app setup — subsequent calls are safe because EventBus.on overwrites
 * existing handlers for the same (event, key) pair.
 */
export function registerBurnSystem(state: { cards: GameCard[] }) {
  // Burn attack damage: fires whenever any unit attacks
  EventBus.on(Event.TARGETED_ATTACK, 'burn_system', async (_e, _id, data, _ctx) => {
    const { source } = data as { source: GameCard; target: GameCard }
    const burnAmount = source.debuffs.burn as number | undefined
    if (burnAmount && burnAmount > 0) {
      await EventBus.emit(Event.PLAYER_DAMAGE, source.gameId, {
        player: source.owner,
        amount: 1,
      })
    }
  })

  // Turn-end burn decrement: fires at the end of each player's turn
  EventBus.on(Event.TURN_END, 'burn_system', (_e, _id, data, _ctx) => {
    const { currentPlayer } = data as { currentPlayer: string }
    for (const card of state.cards) {
      if (card.owner !== currentPlayer) continue
      if (typeof card.debuffs.burn !== 'number') continue
      card.debuffs.burn -= 1
      if (card.debuffs.burn <= 0) {
        delete card.debuffs.burn
      }
    }
  })
}
