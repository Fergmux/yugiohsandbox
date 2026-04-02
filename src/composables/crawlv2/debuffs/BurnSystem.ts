import type { GameCard } from '@/types/cards'
import { Event, EventBus } from '../EventBus'

/**
 * Registers global EventBus listeners that implement burn debuff behaviour:
 *
 *  - When a unit's attack resolves (not negated), if the attacker is burnt,
 *    emit PLAYER_DAMAGE (1 damage) to the owning player.
 *  - At the end of the owning player's turn, decrement all their cards' burn stacks by 1
 *    and remove the debuff when it reaches 0.
 *
 * @param getCards - A function that returns the current game cards array
 */
export function registerBurnSystem(getCards: () => GameCard[]) {
  // Burn attack damage: fires only after attack is confirmed (not negated)
  EventBus.on(Event.ATTACK_RESOLVED, 'burn_system', async (_e, _id, data, _ctx) => {
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
    const cards = getCards()
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
