<script setup lang="ts">
import type { Ref } from 'vue'
import { computed, inject } from 'vue'

import type { YugiohCard } from '@/types/yugiohCard'
import { getS3ImageUrl } from '@/utils'

import IconButton from './IconButton.vue'

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

const actionTitleMap: Record<string, string> = {
  flip: 'Flip',
  position: 'Change position',
  'shuffle-in': 'Shuffle in',
  'place-top': 'Place on top',
  'place-bottom': 'Place on bottom',
  shuffle: 'Shuffle deck',
  set: 'Set',
  defence: 'Summon defence',
  'face-down': 'Banish face down',
  'face-up': 'Banish face up',
  search: 'Search',
  attach: 'Attach',
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
  dropZone?: string
  dropIndex?: number
  opponentSelected?: boolean
}>()
const emit = defineEmits<{
  (e: 'action', name: string): void
  (e: 'increment', count: number): void
  (e: 'update', name: string, stat?: 'attack' | 'defence'): void
}>()

const dragHoverZone = inject<Ref<{ location: string; index?: number } | null>>('dragHoverZone')
const isDragActive = inject<Ref<boolean>>('isDragActive')
const draggingCardUid = inject<Ref<string | undefined>>('draggingCardUid')

const isDropHighlighted = computed(() => {
  if (!isDragActive?.value || !dragHoverZone?.value || !props.dropZone) return false
  if (dragHoverZone.value.location !== props.dropZone) return false
  if (props.dropIndex !== undefined) return dragHoverZone.value.index === props.dropIndex
  return true
})

const isDragSource = computed(() => {
  return !!draggingCardUid?.value && props.card?.uid === draggingCardUid.value
})

const cardList = computed(() => props.cards ?? [props.card])

const getClassStyle = (card: YugiohCard, index: number) => {
  const rotated = card.defence || cardList.value[0]?.defence
  const modifier = 1.5
  return {
    class: {
      'border-4 border-yellow-200': props.selected || index === props.selectedIndex,
      'border-4 border-red-600': props.opponentSelected,
      'rotate-90': rotated,
    },
    style: {
      left: rotated
        ? '50%'
        : `calc(50% + min(${(index * modifier) / cardList.value.length}vw, ${(index * modifier) / cardList.value.length}vh))`,
      // : `calc(50% + (${index / 2} * (min(5vh,5vw) / ${cardList.value.length}))}px)`,
      top: rotated
        ? `min(${(index * modifier) / cardList.value.length}vw, ${(index * modifier) / cardList.value.length}vh)`
        : undefined,
      zIndex: 100 - index,
    },
  }
}

const topCard = computed(() => props.card || cardList.value[0])

const cardAtk = computed({
  get: () => {
    const atk = topCard.value?.newAttack || topCard.value?.atk
    return atk != null ? Math.max(atk, 0) : atk
  },
  set: (value) => {
    if (topCard.value != null) {
      topCard.value.newAttack = value
      emit('update', topCard.value.name, 'attack')
    }
  },
})

const cardDef = computed({
  get: () => {
    const def = topCard.value?.newDefence || topCard.value?.def
    return def != null ? Math.max(def, 0) : def
  },
  set: (value) => {
    if (topCard.value != null) {
      topCard.value.newDefence = value
      emit('update', topCard.value.name, 'defence')
    }
  },
})
</script>

<template>
  <div
    class="relative aspect-square overflow-hidden border-1 border-gray-300 p-px"
    :class="{ 'ring-2 ring-yellow-400 ring-inset': isDropHighlighted }"
    :data-drop-zone="dropZone"
    :data-drop-index="dropIndex"
  >
    <div
      class="pointer-events-none absolute inset-0 z-0 bg-contain bg-center bg-no-repeat opacity-60 grayscale"
      :style="{ backgroundImage: `url('${getS3ImageUrl(0)}')` }"
      aria-hidden="true"
    />
    <div
      v-if="name"
      class="absolute top-1/2 left-1/2 w-full -translate-x-1/2 -translate-y-1/2 text-center text-[min(1vh,1vw)] font-bold text-gray-400 opacity-70"
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
        :class="{ 'opacity-30': isDragSource }"
      />
    </template>
    <div class="relative h-full w-full">
      <div
        class="absolute z-[110] flex h-full flex-col flex-wrap items-center gap-[min(0.25vh,0.25vw)]"
        :class="{ 'rotate-180': rotate }"
      >
        <div
          v-for="counter in counters"
          :key="counter"
          class="size-[min(1.5vh,1.5vw)] rounded-full border-1 border-gray-300 bg-gray-600 text-center text-[min(0.85vh,0.85vw)]"
        >
          {{ counter }}
        </div>
      </div>

      <div
        v-if="topCard != null && !topCard.faceDown && (cardAtk != null || cardDef != null)"
        class="absolute top-3/5 left-1/2 z-[120] flex -translate-x-1/2 -translate-y-1/2 gap-2 text-center text-[min(0.75vh,0.75vw)] font-bold"
        :style="{ transform: rotate ? 'rotate(180deg)' : '' }"
      >
        <div v-if="cardAtk != null">
          <p class="mx-auto w-min bg-black text-white">ATK</p>
          <input
            type="number"
            class="max-w-[min(3vh,3vw)] bg-black text-center"
            @click.stop
            @keyup.enter.stop="($event.target as HTMLInputElement).blur()"
            :class="
              topCard.newAttack && topCard.atk
                ? topCard.newAttack < topCard.atk
                  ? 'text-red-400'
                  : 'text-green-400'
                : 'text-white'
            "
            :disabled="!controls"
            v-model.lazy="cardAtk"
          />
        </div>
        <div v-if="cardDef != null" class="">
          <p class="mx-auto w-min bg-black text-white">DEF</p>
          <input
            type="number"
            class="max-w-[min(3vh,3vw)] bg-black text-center"
            @click.stop
            @keyup.enter.stop="($event.target as HTMLInputElement).blur()"
            :class="
              topCard.newDefence && topCard.def
                ? topCard.newDefence < topCard.def
                  ? 'text-red-400'
                  : 'text-green-400'
                : 'text-white'
            "
            :disabled="!controls"
            v-model.lazy="cardDef"
          />
        </div>
      </div>

      <div class="absolute top-0 z-[130] h-full w-full opacity-0 hover:opacity-100">
        <div v-if="controls" class="absolute top-0 right-0 flex w-min gap-1">
          <icon-button :scale="0.6" title="Remove counter" @click.stop="emit('increment', -1)"> remove </icon-button>
          <icon-button :scale="0.6" title="Add counter" @click.stop="emit('increment', 1)"> add </icon-button>
        </div>

        <p
          v-if="hint"
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-200"
          :class="{ 'rotate-180': rotate }"
        >
          {{ hint }}
        </p>
        <div v-if="actions" class="absolute bottom-0 flex w-full justify-center gap-2">
          <icon-button
            v-for="action in actions"
            :key="action"
            @click.stop="emit('action', action)"
            :title="actionTitleMap[action]"
          >
            {{ actionIconMap[action] }}
          </icon-button>
        </div>
      </div>
    </div>
  </div>
</template>
