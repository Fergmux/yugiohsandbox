export type EventContext = { cancelled: boolean; cancel(): void }
type EventListener = (event: Event, targetId: string, data: unknown, ctx: EventContext) => void | Promise<void>
const listeners: Record<string, Record<string, EventListener[]>> = {}

export enum Event {
  TARGETED_ATTACK = 'targeted_attack',
  ATTACK_RESOLVED = 'attack_resolved',
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
  CARD_LEFT_FIELD = 'card_left_field',
  TURN_START = 'turn_start',
  TURN_END = 'turn_end',
  PLAYER_DAMAGE = 'player_damage',
  ACTIVATE_EFFECT = 'activate_effect',
  CLEANSE_APPLIED = 'cleanse_applied',
  BURN_APPLIED = 'burn_applied',
}

export const EventBus = {
  on(event: Event, key: string, fn: EventListener) {
    if (!listeners[event]) listeners[event] = {}
    if (!listeners[event][key]) listeners[event][key] = []
    listeners[event][key].push(fn)
  },

  off(event: Event, key: string) {
    delete listeners[event]?.[key]
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
    for (const fns of Object.values(handlers)) {
      for (const fn of fns) await fn(event, triggerCardId, data, ctx)
    }
    return ctx
  },
}
