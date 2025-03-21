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
  rotate?: boolean
}>()
const emit = defineEmits<{
  (e: 'action', name: string): void
  (e: 'increment', count: number): void
  (e: 'update', name: string, stat?: 'attack' | 'defence'): void
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

const topCard = computed(() => props.card || cardList.value[0])

const cardAtk = computed({
  get: () => topCard.value?.newAttack || topCard.value?.atk,
  set: (value) => {
    if (topCard.value) {
      topCard.value.newAttack = value
      emit('update', topCard.value.name, 'attack')
    }
  },
})

const cardDef = computed({
  get: () => topCard.value?.newDefence || topCard.value?.def,
  set: (value) => {
    if (topCard.value) {
      topCard.value.newDefence = value
      emit('update', topCard.value.name, 'defence')
    }
  },
})
</script>

<template>
  <div class="relative aspect-square border-1 border-gray-300">
    <div
      v-if="name"
      class="absolute top-1/2 left-1/2 w-full -translate-x-1/2 -translate-y-1/2 text-center text-xl font-bold text-gray-400 opacity-70"
      :class="{ 'rotate-180': rotate }"
    >
      {{ name }}
    </div>
    <template v-for="(card, index) in cardList" :key="card?.id">
      <img
        v-if="card"
        :key="`${card.id}-${index}`"
        :src="getS3ImageUrl(card.faceDown ? 0 : card.id)"
        v-bind="getClassStyle(card, index)"
        class="absolute m-auto max-h-full -translate-x-1/2"
      />
    </template>
    <div class="relative h-full w-full">
      <div
        class="absolute z-[110] flex h-full flex-col flex-wrap items-center"
        :class="{ 'rotate-180': rotate }"
      >
        <div
          v-for="counter in counters"
          :key="counter"
          class="m-1 size-7 rounded-full border-1 border-gray-300 bg-gray-600 text-center leading-6"
        >
          {{ counter }}
        </div>
      </div>

      <p
        v-if="topCard && !topCard.faceDown && (cardAtk || cardDef)"
        class="absolute top-2/3 left-1/2 z-[120] flex -translate-x-1/2 -translate-y-1/2 text-center font-bold"
      >
        <input
          v-if="cardAtk"
          type="number"
          class="mr-2 max-w-12 bg-black text-center"
          @click.stop
          :style="{ transform: rotate ? 'rotate(180deg)' : '' }"
          :class="
            topCard.newAttack
              ? topCard.newAttack < topCard.atk
                ? 'text-red-400'
                : 'text-green-400'
              : 'text-white'
          "
          :disabled="!controls"
          v-model="cardAtk"
        />

        <input
          v-if="cardDef"
          type="number"
          class="max-w-12 bg-black text-center"
          :style="{ transform: rotate ? 'rotate(180deg)' : '' }"
          @click.stop
          :class="
            topCard.newDefence
              ? topCard.newDefence < topCard.def
                ? 'text-red-400'
                : 'text-green-400'
              : 'text-white'
          "
          :disabled="!controls"
          v-model="cardDef"
        />
      </p>

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

        <p
          v-if="hint"
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-200"
          :class="{ 'rotate-180': rotate }"
        >
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
