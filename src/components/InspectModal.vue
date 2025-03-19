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
  cardIndex?: number
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

const isSelected = (index: number) => {
  if (!Array.isArray(props.cards) && props.selectedIndex && props.cardIndex) {
    return props.selectedIndex === props.cardIndex
  }
  if (
    Array.isArray(props.cards) &&
    props.inspectedCardsLocation === 'attached' &&
    props.selectedIndex &&
    props.cardIndex &&
    index === 0
  ) {
    return props.selectedIndex === props.cardIndex
  }

  return (
    index ===
    (props.inspectedCardsLocation === 'attached' ? props.selectedIndex! + 1 : props.selectedIndex!)
  )
}

const selectCard = (index: number) =>
  Array.isArray(props.cards) ? emit('select', index) : emit('select', props.cardIndex!)

const drawCard = (destination: keyof BoardSide, index: number, card: YugiohCard) => {
  emit('draw', destination, index, !revealedCardIds.value.includes(card.uid))
}
const showCardIds = computed(() => props.showCards?.map((card) => card.uid) ?? [])
const revealedCards = ref<Set<YugiohCard>>(props.showCards ? new Set(props.showCards) : new Set())
const revealedCardIds = computed(() => Array.from(revealedCards.value).map((card) => card.uid))
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
        <div v-for="(card, index) in cardList" :key="`${card.id}+${index}`" class="relative">
          <img
            :src="getS3ImageUrl(card.faceDown && !revealedCardIds.includes(card.uid) ? 0 : card.id)"
            class="m-auto h-full max-h-screen"
            @click.right.prevent="
              cardList?.length > 1 && (!card?.faceDown || revealedCardIds.includes(card.uid))
                ? (selectedCard = card)
                : revealedCards.add(card)
            "
            @click.stop="selectCard(index)"
            @dragstart.prevent=""
            :class="{
              'border-4 border-yellow-200': isSelected(index),
            }"
          />
          <div class="absolute bottom-0 flex w-full flex-wrap-reverse justify-center gap-2">
            <button
              v-if="
                !(inspectedCardsLocation === 'attached' && index === 0) &&
                inspectedCardsLocation !== 'hand' &&
                Array.isArray(cards)
              "
              title="Draw"
              @click.stop="drawCard('hand', index, card)"
              class="rounded-full border-1 border-gray-300 bg-gray-400 p-2 leading-1 text-black"
            >
              <span class="material-symbols-outlined">back_hand</span>
            </button>
            <button
              v-if="
                !(inspectedCardsLocation === 'attached' && index === 0) &&
                inspectedCardsLocation !== 'graveyard' &&
                Array.isArray(cards) &&
                inspectedCardsLocation !== 'tokens'
              "
              title="Graveyard"
              @click.stop="drawCard('graveyard', index, card)"
              class="rounded-full border-1 border-gray-300 bg-gray-400 p-2 leading-1 text-black"
            >
              <span class="material-symbols-outlined">skull</span>
            </button>
            <button
              v-if="
                !(inspectedCardsLocation === 'attached' && index === 0) &&
                inspectedCardsLocation !== 'banished' &&
                Array.isArray(cards) &&
                inspectedCardsLocation !== 'tokens'
              "
              title="Banish"
              @click.stop="drawCard('banished', index, card)"
              class="rounded-full border-1 border-gray-300 bg-gray-400 p-2 leading-1 text-black"
            >
              <span class="material-symbols-outlined">block</span>
            </button>
            <button
              v-if="
                Array.isArray(cards) &&
                inspectedCardsLocation !== 'tokens' &&
                revealedCardIds.includes(card.uid) &&
                !showCardIds.includes(card.uid)
              "
              @click.stop="
                revealedCardIds.includes(card.uid)
                  ? revealedCards.delete(card)
                  : revealedCards.add(card)
              "
              class="rounded-full border-1 border-gray-300 bg-gray-400 p-2 leading-1 text-black"
            >
              <span class="material-symbols-outlined">
                {{ revealedCardIds.includes(card.uid) ? 'visibility_off' : 'visibility' }}
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
      :show-cards="Array.from(revealedCards)"
      :inspected-cards-location="inspectedCardsLocation"
    />
  </Teleport>
</template>
