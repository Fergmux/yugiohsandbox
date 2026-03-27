import type { BoardSide, GameEdit, GameState, YugiohCard } from '@/types/yugiohCard'

function findCardIndex(cards: (YugiohCard | null)[], cardUid: string): number {
  return cards.findIndex((c) => c?.uid === cardUid)
}

function removeCardFromLocation(
  playerCards: BoardSide,
  location: keyof BoardSide,
  cardUid: string,
): YugiohCard | null {
  if (location === 'field' || location === 'zones') {
    const cards = playerCards[location]
    const index = findCardIndex(cards, cardUid)
    if (index === -1) return null
    const card = cards[index]
    cards[index] = null
    return card
  }
  const cards = playerCards[location]
  const index = findCardIndex(cards, cardUid)
  if (index === -1) return null
  return cards.splice(index, 1)[0] ?? null
}

function addCardToLocation(
  playerCards: BoardSide,
  location: keyof BoardSide,
  card: YugiohCard,
  index?: number,
) {
  if (location === 'field' || location === 'zones') {
    const cards = playerCards[location]
    if (index !== undefined && cards[index] === null) {
      cards[index] = card
    } else if (index !== undefined) {
      cards.splice(index, 0, card)
    } else {
      cards.unshift(card)
    }
    return
  }
  const cards = playerCards[location]
  if (index !== undefined) {
    cards.splice(index, 0, card)
  } else if (location === 'hand') {
    cards.push(card)
  } else {
    cards.unshift(card)
  }
}

function setZone(playerCards: BoardSide, location: keyof BoardSide, cards: (YugiohCard | null)[]) {
  if (location === 'field' || location === 'zones') {
    playerCards[location].splice(0, playerCards[location].length, ...cards)
    return
  }
  const nonNullCards: YugiohCard[] = []
  for (const c of cards) {
    if (c) nonNullCards.push(c)
  }
  playerCards[location].splice(0, playerCards[location].length, ...nonNullCards)
}

export function applyEdit(state: GameState, edit: GameEdit): void {
  switch (edit.type) {
    case 'move_card': {
      const playerCards = state.cards[edit.player]
      const removed = removeCardFromLocation(playerCards, edit.fromLocation, edit.cardUid)
      if (!removed) return
      addCardToLocation(playerCards, edit.toLocation, edit.cardData, edit.toIndex)
      break
    }
    case 'transfer_card': {
      const removed = removeCardFromLocation(
        state.cards[edit.fromPlayer],
        edit.fromLocation,
        edit.cardUid,
      )
      if (!removed) return
      addCardToLocation(state.cards[edit.toPlayer], edit.toLocation, edit.cardData)
      break
    }
    case 'update_card': {
      const cards = state.cards[edit.player][edit.location]
      const index = findCardIndex(cards, edit.cardUid)
      if (index === -1) return
      const card = cards[index]
      if (card) Object.assign(card, edit.updates)
      break
    }
    case 'set_zone': {
      setZone(state.cards[edit.player], edit.location, edit.cards)
      break
    }
    case 'set_turn': {
      state.turn = edit.turn
      break
    }
    case 'set_coin_flip': {
      state.coinFlip = edit.coinFlip
      break
    }
    case 'set_life_points': {
      state.lifePoints[edit.player] = edit.value
      break
    }
    case 'set_player': {
      state.players[edit.player] = edit.user
      break
    }
    case 'set_deck_id': {
      state.decks[edit.player] = edit.deckId
      break
    }
    case 'append_log': {
      for (const entry of edit.entries) {
        const exists = state.gameLog.some(
          (e) => e.timestamp === entry.timestamp && e.text === entry.text,
        )
        if (!exists) {
          state.gameLog.push(entry)
        }
      }
      break
    }
  }
}

export function applyEdits(state: GameState, edits: GameEdit[]): GameState {
  for (const edit of edits) {
    applyEdit(state, edit)
  }
  return state
}
