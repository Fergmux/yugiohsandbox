import type { ComputedRef, Ref } from 'vue'

import type { BoardSide, GameEdit, Player, YugiohCard } from '@/types/yugiohCard'

type CardLocation = keyof BoardSide | 'attached'

const zoneNameMap: Record<keyof BoardSide, string> = {
  field: 'the field',
  zones: 'an extra zone',
  hand: 'their hand',
  banished: 'the banished zone',
  deck: 'the deck',
  extra: 'the extra deck',
  tokens: 'the token deck',
  graveyard: 'the graveyard',
  attached: 'a monster',
}

interface UseCardMovementOptions {
  player: ComputedRef<Player>
  getCards: (location: keyof BoardSide) => (YugiohCard | null)[]
  getCard: (location: keyof BoardSide, index: number) => YugiohCard | null
  sendEdit: (edits: GameEdit[], logText?: string) => void
  selectedCard: Ref<YugiohCard | undefined>
  selectedCardLocation: Ref<CardLocation | undefined>
  selectedCardIndex: Ref<number | undefined>
  resetSelectedCard: () => void
  isCrawl: ComputedRef<boolean>
}

export function useCardMovement({
  player,
  getCards,
  getCard,
  sendEdit,
  selectedCard,
  selectedCardLocation,
  selectedCardIndex,
  resetSelectedCard,
  isCrawl,
}: UseCardMovementOptions) {
  const cardName = (card?: YugiohCard) => (card?.faceDown ? 'a card' : card?.name)
  const zoneName = (zone?: keyof BoardSide) => (zone ? zoneNameMap[zone] : undefined)

  function findCardOnField(name: string): YugiohCard | undefined {
    for (const loc of ['field', 'zones'] as (keyof BoardSide)[]) {
      const found = getCards(loc).find((c: YugiohCard | null) => c?.name === name)
      if (found) return found as YugiohCard
    }
    return undefined
  }

  function findCardLocation(uid: string): keyof BoardSide | undefined {
    const locations: (keyof BoardSide)[] = [
      'field',
      'zones',
      'hand',
      'graveyard',
      'banished',
      'extra',
      'deck',
      'tokens',
      'attached',
    ]
    for (const loc of locations) {
      if (getCards(loc).some((c: YugiohCard | null) => c?.uid === uid)) return loc
    }
    return undefined
  }

  // Find the slot closest to the middle of the given indices
  function findMiddleFreeSlot(indices: number[]): number {
    const field = getCards('field')
    const mid = indices[Math.floor(indices.length / 2)]
    return [...indices].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid)).find((i) => field[i] === null) ?? -1
  }

  // Build the card data object for a destination zone, applying orientation/state resets
  function buildCardForDestination(
    card: YugiohCard,
    destination: keyof BoardSide,
    currentLocation: keyof BoardSide,
    index?: number,
    options?: {
      faceDown?: boolean
      defence?: boolean
      newAttack?: number | null
      newDefence?: number | null
      attached?: string
    },
  ): YugiohCard {
    const opts = { ...options }

    // Clear stat overrides when leaving the field
    if (destination !== 'field' && destination !== 'zones') {
      opts.newAttack = null
      opts.newDefence = null
    }

    // Placing onto a specific slot
    if (index !== undefined) {
      const target = getCard(destination, index)
      if (target === null) {
        const orientationOptions =
          currentLocation === 'field' || currentLocation === 'zones' ? {} : { faceDown: false, defence: false }
        return { ...card, ...orientationOptions, ...opts }
      }
      return { ...card, faceDown: true, defence: false, counters: 0, ...opts }
    }

    // Hidden zones reset orientation
    if (destination === 'deck' || destination === 'extra' || destination === 'tokens') {
      return { ...card, faceDown: true, defence: false, counters: 0, ...opts }
    }

    return { ...card, defence: false, counters: 0, ...opts, faceDown: false }
  }

  // Core move: builds edits to move the selected card (and its attachments) to a destination
  function moveCard(
    destination: keyof BoardSide,
    index?: number,
    options?: { faceDown?: boolean; defence?: boolean; attached?: string },
  ): GameEdit[] {
    options = options ?? {}
    if (!selectedCardLocation.value || selectedCardIndex.value === undefined) return []
    const card = getCard(selectedCardLocation.value, selectedCardIndex.value)
    if (!card) return []

    // Movement restrictions
    if (destination === 'tokens' && card.type !== 'Token') return []
    if (card.type === 'Token' && !['tokens', 'field', 'hand'].includes(destination)) return []
    if (selectedCardLocation.value === 'hand' && destination === 'hand') return []

    const edits: GameEdit[] = []
    const fromLocation = selectedCardLocation.value as keyof BoardSide

    // Move attached cards along with the parent when leaving the field
    const attachedCards = getCards('attached').filter((c) => c?.attached === card?.uid) as YugiohCard[]
    if (destination !== 'field' && destination !== 'zones' && attachedCards.length) {
      attachedCards.forEach((c) => {
        edits.push({
          type: 'move_card',
          player: player.value,
          cardUid: c.uid,
          fromLocation: 'attached',
          toLocation: destination,
          cardData: buildCardForDestination(c, destination, 'attached', undefined, options),
        })
      })
    }

    edits.push({
      type: 'move_card',
      player: player.value,
      cardUid: card.uid,
      fromLocation,
      toLocation: destination,
      toIndex: index,
      cardData: buildCardForDestination(card, destination, fromLocation, index, options),
    })

    resetSelectedCard()
    return edits
  }

  // Move selected card and emit a log message
  function logMoveCard(
    destination: keyof BoardSide,
    index?: number,
    options?: { faceDown?: boolean; defence?: boolean },
  ) {
    options = options ?? {}
    if (!selectedCard.value || !selectedCardLocation.value) return
    const name = destination === 'graveyard' ? selectedCard.value.name : cardName(selectedCard.value)
    const logText = `moved ${name} from ${zoneName(selectedCardLocation.value)} to ${zoneName(destination)}`
    const edits = moveCard(destination, index, options)
    if (edits.length) sendEdit(edits, logText)
  }

  function flipCard(card: YugiohCard) {
    const location = findCardLocation(card.uid) ?? 'field'
    sendEdit(
      [
        {
          type: 'update_card',
          player: player.value,
          cardUid: card.uid,
          location,
          updates: { faceDown: !card.faceDown },
        },
      ],
      `flipped ${card.name} ${!card.faceDown ? 'face down' : 'face up'}`,
    )
  }

  function drawCard(source: keyof BoardSide) {
    if (!getCards(source).length) {
      // In crawl mode, recycle graveyard into deck when deck is empty
      if (isCrawl.value && source === 'deck') {
        const shuffled = [...getCards('graveyard')]
          .sort(() => Math.random() - 0.5)
          .map((c) => ({ ...c, faceDown: true }) as YugiohCard)
        sendEdit(
          [
            { type: 'set_zone', player: player.value, location: 'deck', cards: shuffled },
            { type: 'set_zone', player: player.value, location: 'graveyard', cards: [] },
          ],
          `moved their graveyard into deck`,
        )
      }
      return
    }
    const card = getCards(source)[0]
    if (!card) return
    sendEdit(
      [
        {
          type: 'move_card',
          player: player.value,
          cardUid: card.uid,
          fromLocation: source,
          toLocation: 'hand',
          cardData: { ...card, faceDown: true },
        },
      ],
      `drew a card from ${zoneName(source)}`,
    )
  }

  return {
    cardName,
    zoneName,
    findCardOnField,
    findCardLocation,
    findMiddleFreeSlot,
    buildCardForDestination,
    moveCard,
    logMoveCard,
    flipCard,
    drawCard,
  }
}
