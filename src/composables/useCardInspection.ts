import type { ComputedRef, Ref } from 'vue'
import { computed, nextTick, ref } from 'vue'

import type { BoardSide, Player, YugiohCard } from '@/types/yugiohCard'

type CardLocation = keyof BoardSide | 'attached'

interface UseCardInspectionOptions {
  player: Ref<Player> | ComputedRef<Player>
  getCards: (location: keyof BoardSide) => (YugiohCard | null)[]
  getCardData: (key: Player) => BoardSide
  extraZones: ComputedRef<(YugiohCard | null)[]>
  isCrawl: ComputedRef<boolean>
}

export function useCardInspection({
  player,
  getCards,
  getCardData,
  extraZones,
  isCrawl,
}: UseCardInspectionOptions) {
  const inspectedCard: Ref<YugiohCard | undefined> = ref()
  const inspectedCardsLocation: Ref<CardLocation | undefined> = ref()
  const inspectedCardsPlayerKey: Ref<Player | undefined> = ref()
  const revealDeck = ref(false)
  const hideInspectControls = ref(false)

  // Set a single card (and its attachments) as inspected
  const inspectCard = (card: YugiohCard | null, location: keyof BoardSide | null) => {
    const attachedCards = getCards('attached').filter((c) => c?.attached === card?.uid) as YugiohCard[]
    inspectedCard.value = card ?? undefined
    inspectedCardsLocation.value = attachedCards.length ? 'attached' : (location ?? undefined)
  }

  // Open the inspect modal for an entire zone
  const inspectCards = (location?: CardLocation, playerKey?: Player) => {
    if (!location) return
    inspectedCardsLocation.value = location ?? undefined
    inspectedCardsPlayerKey.value = playerKey ?? player.value
  }

  // The resolved list of cards shown in the inspect modal
  const inspectedCardsList = computed(() => {
    if (inspectedCard.value) {
      const attachedCards = getCards('attached').filter((c) => c?.attached === inspectedCard.value?.uid)
      return attachedCards.length && inspectedCard.value
        ? ([inspectedCard.value, ...attachedCards].filter(Boolean) as YugiohCard[])
        : inspectedCard.value
    }

    if (!inspectedCardsLocation.value || !inspectedCardsPlayerKey.value) return undefined

    const cardsToInspect = getCardData(inspectedCardsPlayerKey.value)[inspectedCardsLocation.value].filter(
      Boolean,
    ) as YugiohCard[]

    if (isCrawl.value && inspectedCardsLocation.value === 'deck' && revealDeck.value) {
      return cardsToInspect.sort(() => Math.random() - 0.5)
    }
    return cardsToInspect
  })

  // Index of the inspected card on the field (for highlighting)
  const inspectedFieldIndex = computed(() => {
    const isFieldLocation =
      inspectedCardsLocation.value === 'field' ||
      inspectedCardsLocation.value === 'zones' ||
      inspectedCardsLocation.value === 'attached'

    if (!isFieldLocation) return undefined

    const targetUid = Array.isArray(inspectedCardsList.value)
      ? inspectedCardsList.value[0]?.uid
      : inspectedCardsList.value?.uid

    const fieldIndex = getCards('field').findIndex((c) => c?.uid === targetUid)
    const zoneIndex = getCards('zones').findIndex((c) => c?.uid === targetUid)

    return fieldIndex === -1 ? zoneIndex : fieldIndex
  })

  // All cards currently visible (for card name search in inspect modal)
  const visibleCards = computed(() => {
    const revealedCards = [
      ...getCards('extra'),
      ...getCards('tokens'),
      ...getCards('field'),
      ...getCards('hand'),
      ...getCards('attached'),
      ...extraZones.value,
    ]
    const cards = revealDeck.value ? [...revealedCards, ...getCards('deck')] : revealedCards
    return cards.filter(Boolean) as YugiohCard[]
  })

  const closeInspectModal = async () => {
    revealDeck.value = false
    hideInspectControls.value = false
    await nextTick()
    inspectCard(null, null)
  }

  return {
    inspectedCard,
    inspectedCardsList,
    inspectedCardsLocation,
    inspectedCardsPlayerKey,
    inspectedFieldIndex,
    visibleCards,
    revealDeck,
    hideInspectControls,
    inspectCard,
    inspectCards,
    closeInspectModal,
  }
}
