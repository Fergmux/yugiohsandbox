import type { GameCard } from '@/types/cards'
import { Event, EventBus } from './EventBus'
import { getGameState } from './GameState'
import { registerBurnSystem } from './debuffs/BurnSystem'
import { registerBlindSystem } from './debuffs/BlindSystem'
import { registerCleanseSystem } from './buffs/CleanseSystem'
import { registerEmpowerSystem } from './buffs/EmpowerSystem'
import { registerShieldSystem } from './buffs/ShieldSystem'
import { registerEvasiveSystem } from './buffs/EvasiveSystem'
import { registerPiercingSystem } from './buffs/PiercingSystem'
import { registerEternalSystem } from './buffs/EternalSystem'
import { registerCursedSystem } from './debuffs/CursedSystem'
import { registerAngerSystem } from './buffs/AngerSystem'
import { registerWeakSystem } from './debuffs/WeakSystem'

// Re-export pure functions from shared lib
export { getEffective, BUFF_STAT_MAP, normalizeStatusKey, propOf } from '@/lib/crawlv2/buff-system'

// Add events here as new mechanics require buff re-evaluation.
export const BUFF_REEVALUATE_EVENTS = [
  Event.CARD_MOVED,
  Event.UNIT_DEFEATED,
  Event.UNIT_SUMMONED,
] as const satisfies readonly Event[]

export function clearBuffsFromSource(sourceId: string) {
  const prefix = `${sourceId}:`
  for (const card of getGameState().cards) {
    for (const key of Object.keys(card.buffs)) {
      if (key.startsWith(prefix)) delete card.buffs[key]
    }
    for (const key of Object.keys(card.debuffs)) {
      if (key.startsWith(prefix)) delete card.debuffs[key]
    }
  }
}

export function registerBuffReevaluation(sourceCard: GameCard, reapply: () => void, cleanup: () => void) {
  const listenerKey = `buff:${sourceCard.gameId}`

  const unregister = () => {
    for (const event of BUFF_REEVALUATE_EVENTS) {
      EventBus.off(event, listenerKey)
    }
  }

  unregister()

  for (const event of BUFF_REEVALUATE_EVENTS) {
    EventBus.on(event, listenerKey, (_e, targetId, _data, _ctx) => {
      const sourceLeft =
        (event === Event.UNIT_DEFEATED && targetId === sourceCard.gameId) ||
        (event === Event.CARD_MOVED && targetId === sourceCard.gameId && sourceCard.location.type !== 'unit')

      if (sourceLeft) {
        cleanup()
        unregister()
      } else {
        reapply()
      }
    })
  }
}

export function registerBuffSystems() {
  registerBurnSystem()
  registerCleanseSystem()
  registerEmpowerSystem()
  registerShieldSystem()
  registerEvasiveSystem()
  registerPiercingSystem()
  registerBlindSystem()
  registerEternalSystem()
  registerCursedSystem()
  registerAngerSystem()
  registerWeakSystem()
}
