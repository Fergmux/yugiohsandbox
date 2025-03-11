<script setup lang="ts">
import type { YugiohCard } from '@/types'
import { computed } from 'vue'

const actionIconMap: Record<string, string> = {
  flip: 'flip',
  position: 'rotate_90_degrees_cw',
  'shuffle-in': 'read_more',
  'place-top': 'vertical_align_top',
  'place-bottom': 'vertical_align_bottom',
  shuffle: 'shuffle',
  set: 'download',
  defence: 'shield',
}

const props = defineProps<{
  card?: YugiohCard | null
  cards?: (YugiohCard | null)[]
  selected?: boolean
  selectedIndex?: false | number
  faceDown?: boolean
  hint?: string | number
  count?: number
  actions?: false | string[]
}>()
const emit = defineEmits<{
  (e: 'action', name: string): void
}>()
const cardList = computed(() => props.cards ?? [props.card])

const getS3ImageUrl = (cardId: number): string =>
  `${import.meta.env.VITE_S3_BUCKET_URL}${cardId}.jpg`
</script>

<template>
  <div class="relative aspect-square border-1 border-gray-300">
    <template v-for="(card, index) in cardList" :key="card?.id">
      <img
        v-if="card"
        :key="card.id"
        :src="getS3ImageUrl(card.faceDown ? 0 : card.id)"
        :class="{
          'border-4 border-yellow-200': selected || index === selectedIndex,
          'rotate-90': card.defence,
        }"
        class="absolute m-auto max-h-full -translate-x-1/2"
        :style="{
          left: `calc(50% + ${index / 2}px)`,
          zIndex: 100 - index,
          // transform: `translateX(calc(-50% - ${cardList.length * 1}px))`,
        }"
      />
    </template>
    <div
      class="absolute top-0 left-0 z-[110] flex h-full w-full items-end justify-center opacity-0 hover:opacity-100"
    >
      <p v-if="hint" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {{ hint }}
      </p>
      <div v-if="actions">
        <button
          v-for="action in actions"
          :key="action"
          @click.stop="emit('action', action)"
          class="m-2 rounded-full border-1 border-gray-300 bg-gray-400 p-2 leading-none text-black active:bg-gray-100"
        >
          <span class="material-icons" :title="action">{{ actionIconMap[action] }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
