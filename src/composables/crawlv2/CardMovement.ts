import type { GameCard } from '@/types/cards'
import type { Location } from '@/types/crawlv2'
import { fieldZones } from '@/types/crawlv2'
import { Event, EventBus } from './EventBus'

/**
 * Single entry point for all card location changes.
 * Automatically emits CARD_MOVED, and CARD_LEFT_FIELD when
 * a card moves from a field zone to a non-field zone.
 */
export async function relocateCard(card: GameCard, newLocation: Location): Promise<void> {
  const oldLocation = card.location
  card.location = newLocation

  if (oldLocation.type === 'deck' && newLocation.type === 'hand') {
    card.faceUp = true
    await EventBus.emit(Event.CARD_DRAWN, card.gameId, { card })
  } else if (newLocation.type === 'deck') {
    card.faceUp = false
  }

  await EventBus.emit(Event.CARD_MOVED, card.gameId, { card })

  if (fieldZones.includes(oldLocation.type) && !fieldZones.includes(newLocation.type)) {
    await EventBus.emit(Event.CARD_LEFT_FIELD, card.gameId, { card })
  }
}
