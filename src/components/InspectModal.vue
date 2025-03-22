<script setup lang="ts">
import type { BoardSide, YugiohCard } from '@/types'
import { getS3ImageUrl } from '@/utils'
import { useOptimalGrid } from '@/utils/useOptimalGrid'
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import InspectModal from './InspectModal.vue'
import IconButton from './IconButton.vue'

const props = defineProps<{
  cards?: YugiohCard[] | YugiohCard
  selectedIndex?: number
  showCards?: YugiohCard[] | undefined
  inspectedCardsLocation?: keyof BoardSide
  cardIndex?: number
  controls?: boolean
}>()

const cardList = computed(
  () => (Array.isArray(props.cards) ? props.cards : [props.cards]).filter(Boolean) as YugiohCard[],
)

// Set default value for showCards
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', index: number): void
  (e: 'draw', destination: keyof BoardSide, index: number, faceDown?: boolean): void
  (e: 'reveal'): void
  (e: 'flip', card: YugiohCard): void
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
const revealCard = (card: YugiohCard) => {
  emit('reveal')
  revealedCards.value.add(card)
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
                : revealCard(card)
            "
            @click.stop="controls && selectCard(index)"
            @dragstart.prevent=""
            :class="{
              'border-4 border-yellow-200': isSelected(index),
            }"
          />
          <div class="absolute bottom-0 mb-2 flex w-full flex-wrap-reverse justify-center gap-2">
            <IconButton
              v-if="
                !(inspectedCardsLocation === 'attached' && index === 0) &&
                inspectedCardsLocation !== 'hand' &&
                controls &&
                Array.isArray(cards)
              "
              title="Draw"
              @click.stop="drawCard('hand', index, card)"
            >
              back_hand
            </IconButton>
            <IconButton
              v-if="
                !(inspectedCardsLocation === 'attached' && index === 0) &&
                inspectedCardsLocation !== 'graveyard' &&
                Array.isArray(cards) &&
                controls &&
                inspectedCardsLocation !== 'tokens'
              "
              title="Graveyard"
              @click.stop="drawCard('graveyard', index, card)"
            >
              skull
            </IconButton>
            <IconButton
              v-if="
                !(inspectedCardsLocation === 'attached' && index === 0) &&
                inspectedCardsLocation !== 'banished' &&
                Array.isArray(cards) &&
                controls &&
                inspectedCardsLocation !== 'tokens'
              "
              title="Banish"
              @click.stop="drawCard('banished', index, card)"
            >
              block
            </IconButton>
            <IconButton
              v-if="
                Array.isArray(cards) &&
                controls &&
                inspectedCardsLocation !== 'tokens' &&
                revealedCardIds.includes(card.uid) &&
                !showCardIds.includes(card.uid)
              "
              @click.stop="
                revealedCardIds.includes(card.uid) ? revealedCards.delete(card) : revealCard(card)
              "
              :title="revealedCardIds.includes(card.uid) ? 'Hide' : 'Show'"
            >
              {{ revealedCardIds.includes(card.uid) ? 'visibility_off' : 'visibility' }}
            </IconButton>
            <IconButton
              v-if="controls && Array.isArray(cards) && inspectedCardsLocation === 'banished'"
              title="Flip"
              @click.stop="emit('flip', card)"
            >
              flip
            </IconButton>
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
