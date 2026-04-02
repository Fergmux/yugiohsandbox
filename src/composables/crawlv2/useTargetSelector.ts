import { ref } from 'vue'
import type { GameCard } from '@/types/cards'

type PendingSelection = {
  validTargets: GameCard[]
  resolve: (selected: GameCard[]) => void
  maxTargets: number
}

const pending = ref<PendingSelection | null>(null)
const selectedTargets = ref<GameCard[]>([])

export function useTargetSelector() {
  function selectTargets(validTargets: GameCard[], maxTargets = 1): Promise<GameCard[]> {
    return new Promise((resolve) => {
      selectedTargets.value = []
      pending.value = { validTargets, resolve, maxTargets }
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

  return { pending, selectedTargets, selectTargets, toggleTarget, confirmSelection, cancelSelection }
}
