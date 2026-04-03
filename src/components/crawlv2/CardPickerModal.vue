<template>
  <div v-if="pendingCardPick" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
    <div class="flex flex-col gap-4 rounded-lg bg-gray-900 p-6 shadow-2xl">
      <div class="flex items-center justify-between gap-6">
        <p class="text-sm font-bold text-white">
          {{ pendingCardPick.label ?? 'Select cards' }}
          <span class="ml-1 text-amber-400">({{ pickedCards.length }}/{{ pendingCardPick.count }})</span>
        </p>
        <button @click="cancelCardPick()" class="text-xs text-red-400 hover:text-red-300">Cancel</button>
      </div>
      <div class="flex flex-wrap gap-3">
        <div
          v-for="card in pendingCardPick.cards"
          :key="card.gameId"
          class="relative h-28 w-[4.67rem] cursor-pointer rounded-md transition-transform"
          :class="
            isPickedCard(card)
              ? 'scale-105 ring-2 ring-amber-400'
              : 'ring-1 ring-gray-600 hover:ring-gray-400'
          "
          @click="togglePickCard(card)"
        >
          <CardBase :card="card" />
        </div>
      </div>
      <button
        v-if="pendingCardPick.count > 1"
        :disabled="pickedCards.length === 0"
        @click="confirmCardPick()"
        class="rounded bg-amber-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Confirm ({{ pickedCards.length }}/{{ pendingCardPick.count }})
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTargetSelector } from '@/composables/crawlv2/useTargetSelector'
import CardBase from '@/components/crawlv2/CardBase.vue'

const { pendingCardPick, pickedCards, togglePickCard, confirmCardPick, cancelCardPick } =
  useTargetSelector()

const isPickedCard = (card: { gameId: string }) =>
  pickedCards.value.some((c) => c.gameId === card.gameId)
</script>
