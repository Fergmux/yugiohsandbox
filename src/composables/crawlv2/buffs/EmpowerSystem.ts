import { Event, EventBus } from '../EventBus'
import { getGameState } from '../GameState'

export function registerEmpowerSystem() {
  EventBus.on(Event.EMPOWER_APPLIED, 'empower_system', async (_e, _id, _data, _ctx) => {})

  EventBus.off(Event.TURN_END, 'empower_system')
  EventBus.on(Event.TURN_END, 'empower_system', (_e, _id, data, _ctx) => {
    const { currentPlayer } = data as { currentPlayer: string }
    const { cards } = getGameState()
    for (const card of cards) {
      if (card.owner !== currentPlayer) continue
      if (typeof card.buffs.empower !== 'number') continue
      card.buffs.empower -= 1
      if (card.buffs.empower <= 0) {
        delete card.buffs.empower
      }
    }
  })
}
