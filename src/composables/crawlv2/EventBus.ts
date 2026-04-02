export type EventContext = { cancelled: boolean; cancel(): void }
type EventListener = (event: Event, targetId: string, data: unknown, ctx: EventContext) => void | Promise<void>
const listeners: Record<string, Map<string, EventListener[]>> = {}

function getMap(event: string): Map<string, EventListener[]> {
  if (!listeners[event]) listeners[event] = new Map()
  return listeners[event]
}

export enum Event {
  UPDATED = 'updated',
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
  CARD_DRAWN = 'card_drawn',
  ATTACK_NEGATED = 'attack_negated',
}

export const EventBus = {
  on(event: Event | Event[], key: string, fn: EventListener) {
    if (Array.isArray(event)) {
      for (const e of event) {
        this.on(e, key, fn)
      }
    } else {
      const map = getMap(event)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(fn)
    }
  },

  off(event: Event, key: string) {
    listeners[event]?.delete(key)
  },

  async emit(event: Event, triggerCardId: string, data: unknown): Promise<{ cancelled: boolean }> {
    const ctx: EventContext = {
      cancelled: false,
      cancel() {
        this.cancelled = true
      },
    }
    const map = listeners[event]
    if (map) {
      for (const fns of map.values()) {
        for (const fn of fns) await fn(event, triggerCardId, data, ctx)
      }
    }
    if (event !== Event.UPDATED) {
      await EventBus.emit(Event.UPDATED, triggerCardId, { card: data })
    }
    return ctx
  },
}
