<script setup lang="ts">
import { getSelectedCardSubtext } from '@/lib/crawlv3/selected-card-rows'
import type { Crawlv3CatalogCard } from '@/types/crawlv3'

defineProps<{
  card: Crawlv3CatalogCard
  count: number
  interactive?: boolean
  variant?: 'default' | 'readonly'
  highlighted?: boolean
}>()

defineEmits<{
  (event: 'select'): void
  (event: 'preview'): void
  (event: 'tooltip', card: Crawlv3CatalogCard, mouseEvent: MouseEvent): void
  (event: 'tooltip-clear', card: Crawlv3CatalogCard): void
}>()
</script>

<template>
  <button
    type="button"
    class="flex w-full items-center gap-3 rounded-2xl border p-2 text-left"
    :class="
      variant === 'readonly'
        ? highlighted
          ? 'cursor-default border-sky-300/70 bg-sky-300/10 ring-2 ring-sky-300/50'
          : 'cursor-default border-white/10 bg-black/20'
        : [
            'border-white/10 bg-white/5 transition hover:border-rose-300/35 hover:bg-rose-300/10',
            highlighted ? 'border-sky-300/70 bg-sky-300/10 ring-2 ring-sky-300/50' : '',
            interactive ? 'cursor-pointer' : 'cursor-default opacity-70',
          ]
    "
    :aria-disabled="!interactive"
    :aria-label="`${card.title} selected ${count} times`"
    @click="interactive && $emit('select')"
    @contextmenu.prevent.stop="$emit('preview')"
    @mouseenter="$emit('tooltip', card, $event)"
    @mousemove="$emit('tooltip', card, $event)"
    @mouseleave="$emit('tooltip-clear', card)"
  >
    <div class="h-14 w-10 shrink-0 overflow-hidden border border-white/10 bg-transparent">
      <img v-if="card.imageUrl" :src="card.imageUrl" :alt="card.title" class="h-full w-full object-cover" />
      <div
        v-else
        class="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,#f7e6c0_0%,#ddc48f_35%,#7b5f31_100%)] text-[0.55rem] font-semibold text-amber-950"
      >
        {{ card.title.slice(0, 2) }}
      </div>
    </div>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-semibold text-white/90">{{ card.title }}</p>
      <p class="mt-0.5 truncate text-xs text-white/45">{{ getSelectedCardSubtext(card) }}</p>
    </div>
    <span class="rounded-full bg-amber-300 px-2 py-1 text-xs font-semibold text-amber-950"> x{{ count }} </span>
  </button>
</template>
