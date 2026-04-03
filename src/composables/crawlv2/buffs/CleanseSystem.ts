import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

export function registerCleanseSystem() {
  EventBus.on(Event.CLEANSE_APPLIED, 'cleanse_system', (_e, targetId, _data, _ctx) => {
    const card = getGameState().cards.find((c) => c.gameId === targetId)
    if (card) {
      card.debuffs = {}
    }
  })

  EventBus.on(Event.TURN_START, 'cleanse_system', (_e, _id, data, _ctx) => {
    const { currentPlayer } = data as { currentPlayer: string }
    const { cards } = getGameState()
    for (const card of cards) {
      if (card.owner !== currentPlayer) continue
      if (typeof card.buffs.cleanse !== 'number') continue
      card.buffs.cleanse -= 1
      if (card.buffs.cleanse <= 0) {
        delete card.buffs.cleanse
      }
    }
  })
}
