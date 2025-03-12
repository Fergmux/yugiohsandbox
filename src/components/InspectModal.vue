<script setup lang="ts">
import type { BoardSide, YugiohCard } from '@/types'
import { getS3ImageUrl } from '@/utils'
import { useOptimalGrid } from '@/utils/useOptimalGrid'
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import InspectModal from './InspectModal.vue'

const props = defineProps<{
  cards?: YugiohCard[] | YugiohCard
  selectedIndex?: number
  showCards?: YugiohCard[] | undefined
  inspectedCardsLocation?: keyof BoardSide
}>()

const cardList = computed(
  () => (Array.isArray(props.cards) ? props.cards : [props.cards]).filter(Boolean) as YugiohCard[],
)

// Set default value for showCards
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', index: number): void
  (e: 'draw', destination: keyof BoardSide, index: number, faceDown?: boolean): void
}>()

const cardLength = computed(() => cardList.value?.length ?? 0)

const { gridStyle } = useOptimalGrid(cardLength)

const selectedCard = ref<YugiohCard | undefined>(undefined)

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

const revealedCards = ref<YugiohCard[]>(props.showCards ? [...props.showCards] : [])
</script>

<template>
  <Teleport to="body">
    <div
      v-if="cardList"
      @click="emit('close')"
      class="fixed top-0 left-0 z-[1000] h-screen w-screen"
    >
      <div
        class="h-max-content absolute top-1/2 left-1/2 grid w-full -translate-x-1/2 -translate-y-1/2 gap-2 overflow-auto p-32"
        :style="cardList?.length > 1 ? gridStyle : 'grid-template-columns: 1fr;'"
      >
        <div v-for="(card, index) in cardList" :key="card.id" class="relative">
          <img
            :src="getS3ImageUrl(card.faceDown && !revealedCards.includes(card) ? 0 : card.id)"
            class="m-auto h-full max-h-screen"
            @click.right.prevent="
              cardList?.length > 1 && (!card?.faceDown || revealedCards.includes(card))
                ? (selectedCard = card)
                : revealedCards.includes(card)
                  ? revealedCards.splice(revealedCards.indexOf(card), 1)
                  : revealedCards.push(card)
            "
            @click.stop="emit('select', index)"
            @dragstart.prevent=""
            :class="{
              'border-4 border-yellow-200': index === selectedIndex,
            }"
          />
          <div class="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-2">
            <button
              v-if="inspectedCardsLocation !== 'hand' && Array.isArray(cards)"
              title="Draw"
              @click.stop="emit('draw', 'hand', index, !revealedCards.includes(card))"
              class="rounded-full border-1 border-gray-300 bg-gray-400 p-2 leading-1 text-black"
            >
              <span class="material-symbols-outlined">back_hand</span>
            </button>
            <button
              v-if="inspectedCardsLocation !== 'graveyard' && Array.isArray(cards)"
              title="Graveyard"
              @click.stop="emit('draw', 'graveyard', index, !revealedCards.includes(card))"
              class="rounded-full border-1 border-gray-300 bg-gray-400 p-2 leading-1 text-black"
            >
              <span class="material-symbols-outlined">skull</span>
            </button>
            <button
              v-if="inspectedCardsLocation !== 'banished' && Array.isArray(cards)"
              title="Banish"
              @click.stop="emit('draw', 'banished', index, !revealedCards.includes(card))"
              class="rounded-full border-1 border-gray-300 bg-gray-400 p-2 leading-1 text-black"
            >
              <span class="material-symbols-outlined">block</span>
            </button>
            <button
              v-if="
                Array.isArray(cards) && !showCards?.includes(card) && revealedCards.includes(card)
              "
              @click.stop="
                revealedCards.includes(card)
                  ? revealedCards.splice(revealedCards.indexOf(card), 1)
                  : revealedCards.push(card)
              "
              class="rounded-full border-1 border-gray-300 bg-gray-400 p-2 leading-1 text-black"
            >
              <span class="material-symbols-outlined">
                {{ revealedCards.includes(card) ? 'visibility_off' : 'visibility' }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <inspect-modal
      v-if="selectedCard"
      :cards="selectedCard"
      @close="selectedCard = undefined"
      :revealed="true"
      :show-cards="revealedCards"
      :inspected-cards-location="inspectedCardsLocation"
    />
  </Teleport>
</template>
