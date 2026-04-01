import { ref } from 'vue'
import type { GameCard } from '@/types/cards'

type PendingActivation = {
  card: GameCard
  resolve: (activate: boolean) => void
}

const pending = ref<PendingActivation | null>(null)

export function useActivationPrompt() {
  function ask(card: GameCard): Promise<boolean> {
    return new Promise((resolve) => {
      pending.value = { card, resolve }
    })
  }

  function respond(activate: boolean) {
    pending.value?.resolve(activate)
    pending.value = null
  }

  return { pending, ask, respond }
}
