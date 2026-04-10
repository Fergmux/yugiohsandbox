import type { GameCard } from '@/types/cards'
import type { Location } from '@/types/crawlv2'
import { Event, EventBus } from './EventBus'
import { getGameState } from './GameState'
import {
  relocateCardPure,
  drawCardPure,
  spendCardPure,
  returnToHandPure,
  moveToDeadPure,
  moveToDeckPure,
  moveSpentToDeckPure,
  shuffleDeckPure,
  drawCardForPlayerPure,
  type MovementEvent,
} from '@/lib/crawlv2/card-movement'

/**
 * Emit EventBus events for the movement events returned by pure functions.
 */
async function emitMovementEvents(events: MovementEvent[]): Promise<void> {
  for (const evt of events) {
    switch (evt.type) {
      case 'card_moved':
        await EventBus.emit(Event.CARD_MOVED, evt.card.gameId, { card: evt.card })
        break
      case 'card_left_field':
        await EventBus.emit(Event.CARD_LEFT_FIELD, evt.card.gameId, { card: evt.card })
        break
      case 'card_drawn':
        await EventBus.emit(Event.CARD_DRAWN, evt.card.gameId, { card: evt.card })
        break
      case 'card_spent':
        await EventBus.emit(Event.CARD_SPENT, evt.card.gameId, { card: evt.card })
        break
    }
  }
}

export async function relocateCard(card: GameCard, newLocation: Location): Promise<void> {
  const events = relocateCardPure(card, newLocation)
  await emitMovementEvents(events)
}

export async function drawCard(card: GameCard): Promise<void> {
  const events = drawCardPure(card, getGameState())
  await emitMovementEvents(events)
}

export async function spendCard(card: GameCard): Promise<void> {
  const events = spendCardPure(card)
  await emitMovementEvents(events)
}

export async function returnToHand(card: GameCard): Promise<void> {
  const events = returnToHandPure(card, getGameState())
  await emitMovementEvents(events)
}

export async function moveToDead(card: GameCard): Promise<void> {
  const events = moveToDeadPure(card)
  await emitMovementEvents(events)
}

export async function moveToDeck(card: GameCard): Promise<void> {
  const events = moveToDeckPure(card, getGameState())
  await emitMovementEvents(events)
}

export async function moveSpentToDeck(player: 'player1' | 'player2'): Promise<void> {
  const events = moveSpentToDeckPure(getGameState(), player)
  await emitMovementEvents(events)
}

export function shuffleDeck(player: 'player1' | 'player2'): void {
  shuffleDeckPure(getGameState(), player)
}

export async function drawCardForPlayer(player: 'player1' | 'player2'): Promise<void> {
  const events = drawCardForPlayerPure(getGameState(), player)
  await emitMovementEvents(events)
}
