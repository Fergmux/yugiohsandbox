export type EventContext = { cancelled: boolean; cancel(): void }
type EventListener = (event: Event, targetId: string, data: unknown, ctx: EventContext) => void | Promise<void>
const listeners: Record<string, Record<string, EventListener>> = {}

export enum Event {
  TARGETED_ATTACK = 'targeted_attack',
  TARGETED_EFFECT = 'targeted_effect',
  DAMAGE_DEALT = 'damage_dealt',
  UNIT_SUMMONED = 'unit_summoned',
  UNIT_DEFEATED = 'unit_defeated',
  TRAP_ACTIVATED = 'trap_activated',
  TRAP_SPENT = 'trap_spent',
  TRAP_SET = 'trap_set',
  EFFECT_PLAYED = 'effect_played',
  POWER_PLAYED = 'power_played',
}

export const EventBus = {
  on(event: Event, targetId: string, fn: EventListener) {
    if (!listeners[event]) listeners[event] = {}
    listeners[event][targetId] = fn
  },

  off(event: Event, targetId: string) {
    delete listeners[event]?.[targetId]
  },

  async emit(event: Event, targetId: string, data: unknown): Promise<{ cancelled: boolean }> {
    const ctx: EventContext = {
      cancelled: false,
      cancel() {
        this.cancelled = true
      },
    }
    const handlers = listeners[event] ?? {}
    console.log(event, 'emitted', targetId, data)
    for (const fn of Object.values(handlers)) await fn(event, targetId, data, ctx)
    return ctx
  },
}
