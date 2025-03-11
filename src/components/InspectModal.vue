<script setup lang="ts">
import type { YugiohCard } from '@/types'
import { getS3ImageUrl } from '@/utils'
import { useOptimalGrid } from '@/utils/useOptimalGrid'
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import InspectModal from './InspectModal.vue'

const props = defineProps<{
  cards?: YugiohCard[]
  selectedIndex?: number
  revealed?: YugiohCard[]
  // actions?: false | string[]
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', index: number): void
  // (e: 'action', name: string): void
}>()

const cardLength = computed(() => props.cards?.length ?? 0)

const { gridStyle } = useOptimalGrid(cardLength)

const selectedCard = ref<YugiohCard[] | undefined>(undefined)

onMounted(() => {
  window.addEventListener('keyup', handleKeyUp, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keyup', handleKeyUp, true)
})

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close')
  }
}

const revealedCards = ref<YugiohCard[]>(props.revealed ?? [])
</script>

<template>
  <Teleport to="body">
    <div v-if="cards" @click="emit('close')" class="fixed top-0 left-0 z-[1000] h-screen w-screen">
      <div
        class="h-max-content absolute top-1/2 left-1/2 grid w-full -translate-x-1/2 -translate-y-1/2 gap-2 overflow-auto p-32"
        :style="cards?.length > 1 ? gridStyle : 'grid-template-columns: 1fr;'"
      >
        <div v-for="(card, index) in cards" :key="card.id" class="relative">
          <img
            :src="getS3ImageUrl(card.faceDown && !revealedCards.includes(card) ? 0 : card.id)"
            class="m-auto"
            @click.right.prevent="
              cards?.length > 1 &&
              (!card?.faceDown || revealedCards.includes(card)) &&
              (selectedCard = [card])
            "
            @click.stop="emit('select', index)"
            @dragstart.prevent=""
            :class="{
              'border-4 border-yellow-200': index === selectedIndex,
            }"
          />
          <button
            v-if="cards.length > 1"
            @click.stop="
              revealedCards.includes(card)
                ? revealedCards.splice(revealedCards.indexOf(card), 1)
                : revealedCards.push(card)
            "
            class="absolute bottom-0 left-1/2 m-2 -translate-x-1/2 rounded-full border-1 border-gray-300 bg-gray-400 p-2 leading-1 text-black"
          >
            <span class="material-icons">
              {{ revealedCards.includes(card) ? 'remove' : 'add' }}
            </span>
          </button>
        </div>
      </div>
    </div>
    <inspect-modal
      v-if="selectedCard"
      :cards="selectedCard"
      @close="selectedCard = undefined"
      :revealed="revealedCards"
    />
  </Teleport>
</template>
