import { ref, computed } from 'vue'
import type { EffectDef, GameCard } from '@/types/cards'
import type { Location } from '@/types/crawlv2'

type PendingSelection = {
  validTargets: GameCard[]
  resolve: (selected: GameCard[]) => void
  maxTargets: number
  optional: boolean
}

type PendingZoneSelection = {
  validZones: Location[]
  resolve: (zone: Location | null) => void
  label?: string
}

type PendingCardPick = {
  cards: GameCard[]
  count: number
  label?: string
  resolve: (selected: GameCard[]) => void
}

const pending = ref<PendingSelection | null>(null)
const selectedTargets = ref<GameCard[]>([])

const pendingZone = ref<PendingZoneSelection | null>(null)

const pendingCardPick = ref<PendingCardPick | null>(null)
const pickedCards = ref<GameCard[]>([])

export function useTargetSelector() {
  function selectTargets(validTargets: GameCard[], effect: EffectDef): Promise<GameCard[]> {
    debugger
    const maxTargets = effect.selectCount
    const optional = !!effect.optional
    const autoApply = validTargets.length === 1

    if (!optional && (maxTargets === undefined || autoApply)) return Promise.resolve(validTargets)

    return new Promise((resolve) => {
      selectedTargets.value = []
      pending.value = { validTargets, resolve, maxTargets: (maxTargets as number) ?? 1, optional }
    })
  }

  function toggleTarget(card: GameCard) {
    const idx = selectedTargets.value.findIndex((c) => c.gameId === card.gameId)
    if (idx >= 0) {
      selectedTargets.value.splice(idx, 1)
      return
    }
    if (pending.value && selectedTargets.value.length >= pending.value.maxTargets) return
    selectedTargets.value.push(card)
    // Auto-confirm when max targets reached
    if (pending.value && selectedTargets.value.length >= pending.value.maxTargets) {
      confirmSelection()
    }
  }

  function confirmSelection() {
    if (!pending.value) return
    pending.value.resolve([...selectedTargets.value])
    pending.value = null
    selectedTargets.value = []
  }

  function cancelSelection() {
    if (!pending.value) return
    pending.value.resolve([])
    pending.value = null
    selectedTargets.value = []
  }

  function selectZone(validZones: Location[], label?: string): Promise<Location | null> {
    return new Promise((resolve) => {
      pendingZone.value = { validZones, resolve, label }
    })
  }

  function pickZone(location: Location) {
    if (!pendingZone.value) return
    pendingZone.value.resolve(location)
    pendingZone.value = null
  }

  function cancelZoneSelection() {
    if (!pendingZone.value) return
    pendingZone.value.resolve(null)
    pendingZone.value = null
  }

  function selectCards(cards: GameCard[], count: number, label?: string): Promise<GameCard[]> {
    return new Promise((resolve) => {
      pickedCards.value = []
      pendingCardPick.value = { cards, count, label, resolve }
    })
  }

  function togglePickCard(card: GameCard) {
    const idx = pickedCards.value.findIndex((c) => c.gameId === card.gameId)
    if (idx >= 0) {
      pickedCards.value.splice(idx, 1)
      return
    }
    if (pendingCardPick.value && pickedCards.value.length >= pendingCardPick.value.count) return
    pickedCards.value.push(card)
    if (pendingCardPick.value && pickedCards.value.length >= pendingCardPick.value.count) {
      confirmCardPick()
    }
  }

  function confirmCardPick() {
    if (!pendingCardPick.value) return
    pendingCardPick.value.resolve([...pickedCards.value])
    pendingCardPick.value = null
    pickedCards.value = []
  }

  function cancelCardPick() {
    if (!pendingCardPick.value) return
    pendingCardPick.value.resolve([])
    pendingCardPick.value = null
    pickedCards.value = []
  }

  const hasSelection = computed(() => !!(pending.value || pendingZone.value || pendingCardPick.value))

  return {
    hasSelection,
    pending,
    selectedTargets,
    selectTargets,
    toggleTarget,
    confirmSelection,
    cancelSelection,
    pendingZone,
    selectZone,
    pickZone,
    cancelZoneSelection,
    pendingCardPick,
    pickedCards,
    selectCards,
    togglePickCard,
    confirmCardPick,
    cancelCardPick,
  }
}
