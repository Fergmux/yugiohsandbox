import type { GameCard } from '@/types/cards'
import type { Location } from '@/types/crawlv2'
import { fieldZones, getLocationId, locations } from '@/types/crawlv2'
import { Event, EventBus } from './EventBus'
import { getGameState } from './GameState'

/**
 * Low-level primitive: mutates card.location and emits CARD_MOVED + CARD_LEFT_FIELD.
 * Prefer the semantic helpers (drawCard, spendCard, etc.) over calling this directly.
 */
export async function relocateCard(card: GameCard, newLocation: Location): Promise<void> {
  const oldLocation = card.location
  card.location = newLocation

  if (newLocation.type === 'deck') card.faceUp = false

  await EventBus.emit(Event.CARD_MOVED, card.gameId, { card })

  if (fieldZones.includes(oldLocation.type) && !fieldZones.includes(newLocation.type)) {
    await EventBus.emit(Event.CARD_LEFT_FIELD, card.gameId, { card })
  }
}

/** Draw the top card from the deck into the first open hand slot for its owner. */
export async function drawCard(card: GameCard): Promise<void> {
  if (card.location.type !== 'deck') return

  const { cards } = getGameState()
  const handSlot = locations.find(
    (loc) => loc.type === 'hand' && loc.player === card.owner && !cards.some((c) => c.location.id === loc.id),
  )
  if (!handSlot) return

  card.faceUp = true
  await EventBus.emit(Event.CARD_DRAWN, card.gameId, { card })
  await relocateCard(card, handSlot)
}

/** Move a card to its owner's spent pile. */
export async function spendCard(card: GameCard): Promise<void> {
  const location: Location = {
    id: getLocationId('spent', 1, card.owner ?? null),
    type: 'spent',
    index: 1,
    player: card.owner ?? null,
    name: 'Spent',
  }
  card.faceUp = true
  card.defensePosition = false
  card.buffs = {}
  card.debuffs = {}
  await relocateCard(card, location)
  await EventBus.emit(Event.CARD_SPENT, card.gameId, { card })
}

/** Return a card to the first open hand slot (from field, spent, etc. — not a draw). */
export async function returnToHand(card: GameCard): Promise<void> {
  const { cards } = getGameState()
  const handSlot = locations.find(
    (loc) => loc.type === 'hand' && loc.player === card.owner && !cards.some((c) => c.location.id === loc.id),
  )
  if (!handSlot) return

  card.faceUp = true
  await relocateCard(card, handSlot)
  await EventBus.emit(Event.CARD_MOVED, card.gameId, { card })
}

/** Move a card to its owner's dead pile. */
export async function moveToDead(card: GameCard): Promise<void> {
  const location: Location = {
    id: getLocationId('dead', 1, card.owner ?? null),
    type: 'dead',
    index: 1,
    player: card.owner ?? null,
    name: 'Dead',
  }
  card.faceUp = true
  card.defensePosition = false
  card.buffs = {}
  card.debuffs = {}
  await relocateCard(card, location)
}

/** Move a card to the top of its owner's deck. */
export async function moveToDeck(card: GameCard): Promise<void> {
  const { cards } = getGameState()
  const deckCards = cards.filter((c) => c.location.type === 'deck' && c.owner === card.owner)
  const location: Location = {
    id: getLocationId('deck', 1, card.owner ?? null),
    type: 'deck',
    index: deckCards.length,
    player: card.owner ?? null,
    name: 'Deck',
  }
  card.faceUp = false
  card.defensePosition = false
  card.buffs = {}
  card.debuffs = {}
  await relocateCard(card, location)
}

/** Move all spent cards back to the deck (without shuffling). */
export async function moveSpentToDeck(player: 'player1' | 'player2'): Promise<void> {
  const { cards } = getGameState()
  const spentCards = cards.filter((c) => c.location.type === 'spent' && c.owner === player)
  if (spentCards.length === 0) return

  for (const card of spentCards) {
    card.buffs = {}
    card.debuffs = {}
    card.faceUp = false
    card.defensePosition = false

    const deckLocation: Location = {
      id: getLocationId('deck', 1, player),
      type: 'deck',
      index: 1,
      player,
      name: 'Deck',
    }
    await relocateCard(card, deckLocation)
  }

  // Reindex deck to have proper ordering
  const deckCards = cards.filter((c) => c.location.type === 'deck' && c.owner === player)
  for (let i = 0; i < deckCards.length; i++) {
    deckCards[i].location.index = i
  }
}

/** Fisher-Yates shuffle the deck for a player. */
export function shuffleDeck(player: 'player1' | 'player2'): void {
  const { cards } = getGameState()
  const deckCards = cards.filter((c) => c.location.type === 'deck' && c.owner === player)

  for (let i = deckCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deckCards[i], deckCards[j]] = [deckCards[j], deckCards[i]]
  }

  // Reindex after shuffle
  for (let i = 0; i < deckCards.length; i++) {
    deckCards[i].location.index = i
  }
}

/** Draw from deck with auto-reshuffle of spent pile when deck is empty. */
export async function drawCardForPlayer(player: 'player1' | 'player2'): Promise<void> {
  const { cards } = getGameState()
  const deckCards = cards
    .filter((c) => c.location.type === 'deck' && c.owner === player)
    .sort((a, b) => b.location.index - a.location.index)

  if (deckCards.length > 0) {
    await drawCard(deckCards[0])
  } else {
    await moveSpentToDeck(player)
    shuffleDeck(player)

    const refreshedDeckCards = getGameState()
      .cards.filter((c) => c.location.type === 'deck' && c.owner === player)
      .sort((a, b) => b.location.index - a.location.index)

    if (refreshedDeckCards.length > 0) {
      await drawCard(refreshedDeckCards[0])
    }
  }
}
