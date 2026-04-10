import type { GameCard } from '../../types/cards.js'
import type { GameState, Location } from '../../types/crawlv2.js'
import { fieldZones, getLocationId, locations } from '../../types/crawlv2.js'

export interface MovementEvent {
  type: 'card_moved' | 'card_left_field' | 'card_drawn' | 'card_spent'
  card: GameCard
}

/**
 * Pure card movement: mutates card.location and returns events that occurred.
 * The composable wrapper emits these via EventBus; the server ignores them.
 */
export function relocateCardPure(card: GameCard, newLocation: Location): MovementEvent[] {
  const events: MovementEvent[] = []
  const oldLocation = card.location
  card.location = newLocation

  if (newLocation.type === 'deck') card.faceUp = false

  events.push({ type: 'card_moved', card })

  if (fieldZones.includes(oldLocation.type) && !fieldZones.includes(newLocation.type)) {
    events.push({ type: 'card_left_field', card })
  }

  return events
}

export function drawCardPure(card: GameCard, gs: GameState): MovementEvent[] {
  if (card.location.type !== 'deck') return []

  const handSlot = locations.find(
    (loc) =>
      loc.type === 'hand' &&
      loc.player === card.owner &&
      !gs.cards.some((c) => c.location.id === loc.id),
  )
  if (!handSlot) return []

  card.faceUp = true
  const events: MovementEvent[] = [{ type: 'card_drawn', card }]
  events.push(...relocateCardPure(card, handSlot))
  return events
}

export function spendCardPure(card: GameCard): MovementEvent[] {
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
  const events = relocateCardPure(card, location)
  events.push({ type: 'card_spent', card })
  return events
}

export function returnToHandPure(card: GameCard, gs: GameState): MovementEvent[] {
  const handSlot = locations.find(
    (loc) =>
      loc.type === 'hand' &&
      loc.player === card.owner &&
      !gs.cards.some((c) => c.location.id === loc.id),
  )
  if (!handSlot) return []

  card.faceUp = true
  return relocateCardPure(card, handSlot)
}

export function moveToDeadPure(card: GameCard): MovementEvent[] {
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
  return relocateCardPure(card, location)
}

export function moveToDeckPure(card: GameCard, gs: GameState): MovementEvent[] {
  const deckCards = gs.cards.filter((c) => c.location.type === 'deck' && c.owner === card.owner)
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
  return relocateCardPure(card, location)
}

export function moveSpentToDeckPure(gs: GameState, player: 'player1' | 'player2'): MovementEvent[] {
  const events: MovementEvent[] = []
  const spentCards = gs.cards.filter((c) => c.location.type === 'spent' && c.owner === player)
  if (spentCards.length === 0) return events

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
    events.push(...relocateCardPure(card, deckLocation))
  }

  const deckCards = gs.cards.filter((c) => c.location.type === 'deck' && c.owner === player)
  for (let i = 0; i < deckCards.length; i++) {
    deckCards[i].location.index = i
  }

  return events
}

export function shuffleDeckPure(gs: GameState, player: 'player1' | 'player2'): void {
  const deckCards = gs.cards.filter((c) => c.location.type === 'deck' && c.owner === player)

  for (let i = deckCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deckCards[i], deckCards[j]] = [deckCards[j], deckCards[i]]
  }

  for (let i = 0; i < deckCards.length; i++) {
    deckCards[i].location.index = i
  }
}

export function drawCardForPlayerPure(
  gs: GameState,
  player: 'player1' | 'player2',
): MovementEvent[] {
  const events: MovementEvent[] = []
  const deckCards = gs.cards
    .filter((c) => c.location.type === 'deck' && c.owner === player)
    .sort((a, b) => b.location.index - a.location.index)

  if (deckCards.length > 0) {
    events.push(...drawCardPure(deckCards[0], gs))
  } else {
    events.push(...moveSpentToDeckPure(gs, player))
    shuffleDeckPure(gs, player)

    const refreshed = gs.cards
      .filter((c) => c.location.type === 'deck' && c.owner === player)
      .sort((a, b) => b.location.index - a.location.index)

    if (refreshed.length > 0) {
      events.push(...drawCardPure(refreshed[0], gs))
    }
  }

  return events
}
