<script setup lang="ts">
import { computed } from 'vue'

import type { Crawlv3CardState } from '@/types/crawlv3'

import cardBackImage from '@/assets/images/cards/cardback.png'

const props = withDefaults(
  defineProps<{
    card: Crawlv3CardState
    showFace: boolean
    selected?: boolean
    ghosted?: boolean
    fillParent?: boolean
    statusLabels?: Record<string, string>
  }>(),
  {
    selected: false,
    ghosted: false,
    fillParent: false,
    statusLabels: () => ({}),
  },
)

defineEmits<{
  (e: 'pointerdown', event: PointerEvent): void
  (e: 'contextmenu', event: MouseEvent): void
  (e: 'mouseenter', event: MouseEvent): void
  (e: 'mousemove', event: MouseEvent): void
  (e: 'mouseleave', event: MouseEvent): void
  (e: 'decrement-status', payload: { kind: 'buff' | 'debuff'; key: string }): void
}>()

const buffEntries = computed(() => Object.entries(props.card.buffs))
const debuffEntries = computed(() => Object.entries(props.card.debuffs))
const cardStyle = computed(() => ({
  width: props.fillParent ? '100%' : 'var(--crawlv3-card-width, clamp(5.2rem, 8vw, 8.4rem))',
  transform: props.card.rotated ? 'rotate(90deg)' : undefined,
}))
</script>

<template>
  <button
    type="button"
    class="relative block aspect-[63/88] overflow-hidden border bg-neutral-950 text-left shadow-[0_1rem_2.5rem_rgba(0,0,0,0.35)] transition-transform"
    :class="[
      selected ? 'border-amber-300 ring-2 ring-amber-300/80' : 'border-white/15',
      ghosted ? 'opacity-40' : 'opacity-100',
    ]"
    :style="cardStyle"
    @pointerdown="$emit('pointerdown', $event)"
    @contextmenu.prevent="$emit('contextmenu', $event)"
    @mouseenter="$emit('mouseenter', $event)"
    @mousemove="$emit('mousemove', $event)"
    @mouseleave="$emit('mouseleave', $event)"
  >
    <template v-if="showFace">
      <img
        v-if="card.imageUrl"
        :src="card.imageUrl"
        :alt="card.title"
        class="absolute inset-0 h-full w-full object-cover"
        draggable="false"
      />

      <div v-else class="absolute inset-0 bg-[radial-gradient(circle_at_top,#f7e6c0_0%,#ddc48f_35%,#7b5f31_100%)]" />

      <div class="absolute inset-x-0 top-0 flex flex-wrap gap-1 p-2 text-[clamp(0.45rem,0.65vw,0.65rem)]">
        <button
          v-for="[key, value] in buffEntries"
          :key="`buff-${key}`"
          type="button"
          class="rounded-full bg-emerald-400/85 px-1.5 py-0.5 font-semibold text-emerald-950"
          @pointerdown.stop
          @click.stop="$emit('decrement-status', { kind: 'buff', key })"
        >
          {{ statusLabels[key] ?? key }} {{ value }}
        </button>
        <button
          v-for="[key, value] in debuffEntries"
          :key="`debuff-${key}`"
          type="button"
          class="rounded-full bg-rose-400/85 px-1.5 py-0.5 font-semibold text-rose-950"
          @pointerdown.stop
          @click.stop="$emit('decrement-status', { kind: 'debuff', key })"
        >
          {{ statusLabels[key] ?? key }} {{ value }}
        </button>
      </div>
    </template>

    <template v-else>
      <img
        :src="cardBackImage"
        alt="Face-down card"
        class="absolute inset-0 h-full w-full object-cover"
        draggable="false"
      />
    </template>
  </button>
</template>
