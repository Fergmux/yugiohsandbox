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
  'face-down': 'system_update_alt',
  'face-up': 'open_in_browser',
  search: 'search',
  attach: 'attach_file',
}

const props = defineProps<{
  card?: YugiohCard | null
  cards?: (YugiohCard | null)[]
  selected?: boolean
  selectedIndex?: false | number
  faceDown?: boolean
  hint?: string | number
  actions?: false | string[]
  controls?: boolean
  counters?: number
  name?: string
}>()
const emit = defineEmits<{
  (e: 'action', name: string): void
  (e: 'increment', count: number): void
}>()
const cardList = computed(() => props.cards ?? [props.card])

const getS3ImageUrl = (cardId: number): string =>
  `${import.meta.env.VITE_S3_BUCKET_URL}${cardId}.jpg`

const getClassStyle = (card: YugiohCard, index: number) => {
  const rotated = card.defence || cardList.value[0]?.defence
  return {
    class: {
      'border-4 border-yellow-200': props.selected || index === props.selectedIndex,
      'rotate-90': rotated,
    },
    style: {
      left: rotated ? '50%' : `calc(50% + ${(index / 2) * (60 / cardList.value.length)}px)`,
      top: rotated ? `calc(${(index / 2) * (60 / cardList.value.length)}px)` : undefined,
      zIndex: 100 - index,
    },
  }
}
</script>

<template>
  <div class="relative aspect-square border-1 border-gray-300">
    <div
      v-if="name"
      class="absolute top-1/2 left-1/2 w-full -translate-x-1/2 -translate-y-1/2 text-center text-xl font-bold text-gray-400 opacity-70"
    >
      {{ name }}
    </div>
    <template v-for="(card, index) in cardList" :key="card?.id">
      <img
        v-if="card"
        :key="card.id"
        :src="getS3ImageUrl(card.faceDown ? 0 : card.id)"
        v-bind="getClassStyle(card, index)"
        class="absolute m-auto max-h-full -translate-x-1/2"
      />
    </template>
    <div class="relative h-full w-full">
      <div class="absolute z-[110] flex h-full flex-col flex-wrap items-center">
        <div
          v-for="counter in counters"
          :key="counter"
          class="m-1 size-7 rounded-full border-1 border-gray-300 bg-gray-600 text-center leading-6"
        >
          {{ counter }}
        </div>
      </div>

      <div class="absolute top-0 z-[110] h-full w-full opacity-0 hover:opacity-100">
        <div v-if="controls" class="absolute top-0 right-0 flex w-min">
          <div
            class="material-symbols-outlined m-1 w-full cursor-pointer rounded-full border-1 border-gray-300 bg-gray-600 select-none active:bg-gray-300"
            @click.stop="emit('increment', -1)"
          >
            remove
          </div>
          <div
            class="material-symbols-outlined m-1 w-full cursor-pointer rounded-full border-1 border-gray-300 bg-gray-600 select-none active:bg-gray-300"
            @click.stop="emit('increment', 1)"
          >
            add
          </div>
        </div>

        <p v-if="hint" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {{ hint }}
        </p>
        <div v-if="actions" class="absolute bottom-0 flex w-full justify-center">
          <button
            v-for="action in actions"
            :key="action"
            @click.stop="emit('action', action)"
            class="m-2 rounded-full border-1 border-gray-300 bg-gray-400 p-2 leading-none text-black active:bg-gray-600"
          >
            <span class="material-symbols-outlined" :title="action">{{
              actionIconMap[action]
            }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
