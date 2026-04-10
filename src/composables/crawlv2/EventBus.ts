export { Event } from '@/types/events'
import { Event } from '@/types/events'

export type EventContext = { cancelled: boolean; resolved: boolean; cancel(): void }
type EventListener = (event: Event, sourceId: string, data: unknown, ctx: EventContext) => void | Promise<void>
const listeners: Record<string, Map<string, EventListener[]>> = {}

function getMap(event: string): Map<string, EventListener[]> {
  if (!listeners[event]) listeners[event] = new Map()
  return listeners[event]
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
