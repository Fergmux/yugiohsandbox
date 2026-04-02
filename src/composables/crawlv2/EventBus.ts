export type EventContext = { cancelled: boolean; cancel(): void }
type EventListener = (event: Event, targetId: string, data: unknown, ctx: EventContext) => void | Promise<void>
const listeners: Record<string, Record<string, EventListener>> = {}

export enum Event {
  TARGETED_ATTACK = 'targeted_attack',
  TARGETED_EFFECT = 'targeted_effect',
  DAMAGE_DEALT = 'damage_dealt',
  UNIT_PLAYED = 'unit_played',
  UNIT_SUMMONED = 'unit_summoned',
  UNIT_DEFEATED = 'unit_defeated',
  TRAP_PLAYED = 'trap_played',
  TRAP_ACTIVATED = 'trap_activated',
  TRAP_SPENT = 'trap_spent',
  TRAP_SET = 'trap_set',
  EFFECT_PLAYED = 'effect_played',
  POWER_PLAYED = 'power_played',
  POWER_SET = 'power_set',
  UNIT_ABILITY = 'unit_ability',
  UNIT_STANCE_SWAP = 'unit_stance_swap',
  CARD_MOVED = 'card_moved',
  TURN_START = 'turn_start',
  TURN_END = 'turn_end',
  PLAYER_DAMAGE = 'player_damage',
}

export const EventBus = {
  on(event: Event, triggerCardId: string, fn: EventListener) {
    if (!listeners[event]) listeners[event] = {}
    listeners[event][triggerCardId] = fn
  },

  off(event: Event, triggerCardId: string) {
    delete listeners[event]?.[triggerCardId]
  },

  async emit(event: Event, triggerCardId: string, data: unknown): Promise<{ cancelled: boolean }> {
    const ctx: EventContext = {
      cancelled: false,
      cancel() {
        this.cancelled = true
      },
    }
    const handlers = listeners[event] ?? {}
    console.log(event, 'emitted', triggerCardId, data)
    for (const fn of Object.values(handlers)) await fn(event, triggerCardId, data, ctx)
    return ctx
  },
}
