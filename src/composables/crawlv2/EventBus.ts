export type EventContext = { cancelled: boolean; resolved: boolean; cancel(): void }
type EventListener = (event: Event, sourceId: string, data: unknown, ctx: EventContext) => void | Promise<void>
const listeners: Record<string, Map<string, EventListener[]>> = {}

function getMap(event: string): Map<string, EventListener[]> {
  if (!listeners[event]) listeners[event] = new Map()
  return listeners[event]
}

export enum Event {
  // Game flow
  UPDATED = 'updated',
  GAME_START = 'game_start',
  TURN_START = 'turn_start',
  TURN_END = 'turn_end',

  // Units
  UNIT_PLAYED = 'unit_played', // Negateable
  UNIT_SUMMONED = 'unit_summoned',
  UNIT_ATTACKED = 'unit_attacked', // Negateable
  UNIT_DEFEATED = 'unit_defeated', // Negateable
  UNIT_SPENT = 'unit_spent',
  UNIT_ABILITY_ATTEMPTED = 'unit_ability_attempted', // Negateable
  UNIT_ABILITY_SUCCESSFUL = 'unit_ability_successful',
  STANCE_SWAP_ATTEMPTED = 'unit_stance_swap_attempted', // Negateable
  STANCE_SWAP_SUCCESSFUL = 'unit_stance_swap_successful',
  SACRIFICE_ATTEMPTED = 'sacrifice_attempted', // Negateable
  SACRIFICE_SUCCESSFUL = 'sacrifice_successful',

  // Combat
  ATTACK_DECLARED = 'attack_declared', // Negateable
  ATTACK_SUCCESSFUL = 'attack_successful',
  DAMAGE_ATTEMPTED = 'damage_attempted', // Negateable
  DAMAGE_DEALT = 'damage_dealt',

  // Traps
  TRAP_PLAYED = 'trap_played', // Negateable
  TRAP_SET = 'trap_set',
  TRAP_ACTIVATED = 'trap_activated', // Negateable
  TRAP_SUCCESSFUL = 'trap_successful',

  // Effects
  EFFECT_PLAYED = 'effect_played', // Negateable
  EFFECT_APPLIED = 'effect_applied',

  // Powers
  POWER_PLAYED = 'power_played', // Negateable
  POWER_SET = 'power_set',
  POWER_ACTIVATED = 'power_activated', // Negateable
  POWER_SUCCESSFUL = 'power_successful',

  // Card movement
  CARD_MOVED = 'card_moved',
  CARD_LEFT_FIELD = 'card_left_field',
  CARD_DRAWN = 'card_drawn',
  CARD_SPENT = 'card_spent',
  CARD_FLIPPED = 'card_flipped',

  // Buffs
  BUFF_ATTEMPTED = 'buff_attempted', // Negateable
  CLEANSE_APPLIED = 'cleanse_applied',
  EMPOWER_APPLIED = 'empower_applied',
  evasive_APPLIED = 'evasive_applied',
  ETERNAL_APPLIED = 'eternal_applied',
  PIERCING_APPLIED = 'piercing_applied',
  SHIELD_APPLIED = 'shield_applied',
  INTANGIBLE_APPLIED = 'intangible_applied',
  DAMAGE_TYPE_APPLIED = 'damage_type_applied',

  // Debuffs
  DEBUFF_ATTEMPTED = 'debuff_attempted', // Negateable
  BURN_APPLIED = 'burn_applied',
  WEAK_APPLIED = 'weak_applied',
  BLIND_APPLIED = 'blind_applied',
  CURSED_APPLIED = 'cursed_applied',
  ANGER_APPLIED = 'anger_applied',
  RETAIN_APPLIED = 'retain_applied',
}

export const costedEvents = [Event.UNIT_PLAYED, Event.TRAP_PLAYED, Event.EFFECT_PLAYED, Event.POWER_PLAYED]

export const EventBus = {
  on(event: Event | Event[], key: string, fn: EventListener) {
    if (Array.isArray(event)) {
      for (const e of event) {
        this.on(e, key, fn)
      }
    } else {
      const map = getMap(event)
      const existing = map.get(key) ?? []
      existing.push(fn)
      map.set(key, existing)
    }
  },

  off(event: Event, key: string) {
    listeners[event]?.delete(key)
  },

  async emit(event: Event, sourceId: string, data: unknown): Promise<{ cancelled: boolean }> {
    const ctx: EventContext = {
      cancelled: false,
      resolved: true,
      cancel() {
        this.cancelled = true
      },
    }
    console.log(event)
    const map = listeners[event]
    if (map) {
      for (const fns of map.values()) {
        for (const fn of fns) await fn(event, sourceId, data, ctx)
      }
    }
    if (event !== Event.UPDATED) {
      await EventBus.emit(Event.UPDATED, sourceId, { card: data })
    }
    return ctx
  },
}
