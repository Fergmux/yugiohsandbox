<script setup lang="ts">
import { computed } from 'vue'

import type { YugiohCard } from '@/types/yugiohCard'
import { getS3ImageUrl } from '@/utils'

import IconButton from './IconButton.vue'

const props = defineProps<{
  card: YugiohCard
  index: number
  handLength: number
  isInteractive?: boolean
  canView?: boolean
  selected?: boolean
  opponentHighlighted?: boolean
  draggingUid?: string
}>()

const emit = defineEmits<{
  (e: 'select'): void
  (e: 'inspect'): void
  (e: 'shiftClick'): void
  (e: 'shiftRightClick'): void
  (e: 'reveal'): void
  (e: 'give'): void
  (e: 'startDrag', event: PointerEvent): void
}>()

function onOverlayClick(e: MouseEvent) {
  if (props.isInteractive) {
    if (e.shiftKey) emit('shiftClick')
    else emit('select')
  } else {
    emit('select')
  }
}

function onOverlayRightClick(e: MouseEvent) {
  if (e.shiftKey) emit('shiftRightClick')
  else emit('inspect')
}

// Fan-out rotation based on position in hand
const fanStyle = computed(() => {
  if (!props.isInteractive) return undefined
  const offset = props.index - (props.handLength - 1) / 2
  const rotation = offset * 5
  const translateY = Math.abs(offset) * 10
  return { transform: `rotate(${rotation}deg) translateY(${translateY}px)` }
})

const imageSrc = computed(() =>
  getS3ImageUrl(props.canView || props.card.revealed ? props.card.id : 0),
)

const isDragging = computed(() => props.draggingUid === props.card?.uid)
</script>

<template>
  <div
    :style="fanStyle"
    :class="isInteractive ? 'group/card z-[140] origin-bottom hover:z-[150]' : ''"
  >
    <div class="relative">
      <!-- Card image with hover scale -->
      <div
        :class="
          isInteractive
            ? 'pointer-events-none origin-bottom transition-transform duration-200 group-hover/card:z-50 group-hover/card:scale-[2]'
            : ''
        "
      >
        <img
          :class="{
            'border-4 border-yellow-200': selected,
            'border-4 border-red-500': opponentHighlighted,
            'opacity-30': isDragging,
          }"
          class="h-full max-h-42 max-w-full min-w-0 object-contain"
          :src="imageSrc"
        />
      </div>

      <!-- Interaction overlay -->
      <div
        :class="
          isInteractive
            ? 'absolute top-0 left-0 h-full w-full opacity-0 group-hover/card:opacity-100'
            : 'absolute top-0 left-0 h-full w-full opacity-0 hover:opacity-100'
        "
        @pointerdown="isInteractive && emit('startDrag', $event)"
        @click.stop="onOverlayClick($event)"
        @click.right.prevent="onOverlayRightClick($event)"
        @dragstart.prevent=""
      >
        <div v-if="isInteractive" class="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-2">
          <icon-button title="Reveal" @click.stop="emit('reveal')">
            {{ card.revealed ? 'visibility_off' : 'visibility' }}
          </icon-button>
          <icon-button title="Give" @click.stop="emit('give')">
            volunteer_activism
          </icon-button>
        </div>
      </div>
    </div>
  </div>
</template>
