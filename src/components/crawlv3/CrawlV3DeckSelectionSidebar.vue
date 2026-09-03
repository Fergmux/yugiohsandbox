<script setup lang="ts">
import CrawlV3SelectedCardRow from '@/components/crawlv3/CrawlV3SelectedCardRow.vue'
import type { Crawlv3SelectedCardRow } from '@/lib/crawlv3/selected-card-rows'
import type { Crawlv3CatalogCard } from '@/types/crawlv3'

const props = withDefaults(
  defineProps<{
    rows: Crawlv3SelectedCardRow[]
    categoryRows: { category: string; count: number }[]
    total: number
    title?: string
    canEdit: boolean
    canHighlight?: boolean
    highlightedCardIds?: Set<string>
  }>(),
  {
    title: 'Your Deck',
    canHighlight: false,
    highlightedCardIds: () => new Set<string>(),
  },
)

const emit = defineEmits<{
  (event: 'clear'): void
  (event: 'remove', cardId: string): void
  (event: 'highlight', card: Crawlv3CatalogCard): void
  (event: 'preview', card: Crawlv3CatalogCard): void
  (event: 'tooltip', card: Crawlv3CatalogCard, mouseEvent: MouseEvent): void
  (event: 'tooltip-clear', card: Crawlv3CatalogCard): void
}>()

function forwardTooltip(card: Crawlv3CatalogCard, mouseEvent: MouseEvent) {
  emit('tooltip', card, mouseEvent)
}

function forwardTooltipClear(card: Crawlv3CatalogCard) {
  emit('tooltip-clear', card)
}

function handleRowSelect(card: Crawlv3CatalogCard) {
  if (props.canEdit) {
    emit('remove', card.id)
    return
  }

  if (props.canHighlight) {
    emit('highlight', card)
  }
}
</script>

<template>
  <aside
    class="rounded-[1.75rem] border border-white/10 bg-neutral-950/70 p-4 shadow-2xl backdrop-blur-sm xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:overflow-y-auto"
  >
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-xs font-semibold tracking-[0.3em] text-white/45 uppercase">Selected</p>
        <h2 class="mt-2 text-2xl font-semibold">{{ title }}</h2>
      </div>
      <button
        type="button"
        class="cursor-pointer rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:border-white/30 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canEdit || !total"
        @click="$emit('clear')"
      >
        Clear Selection
      </button>
    </div>

    <div v-if="categoryRows.length" class="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
      <div class="flex items-center justify-between gap-3 text-white/75">
        <span class="font-semibold">Category Counts</span>
        <span>{{ total }} total</span>
      </div>
      <div class="mt-3 space-y-2">
        <div
          v-for="{ category, count } in categoryRows"
          :key="`selected-category-${category}`"
          class="flex items-center justify-between gap-3 text-white/60"
        >
          <span class="truncate">{{ category }}</span>
          <span class="rounded-full bg-black/25 px-2 py-0.5 text-xs font-semibold text-white/75">
            {{ count }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="!rows.length" class="mt-4 rounded-[1rem] border border-white/10 bg-white/5 p-4 text-sm text-white/50">
      No cards selected.
    </div>

    <div v-else class="mt-4 space-y-2">
      <CrawlV3SelectedCardRow
        v-for="{ card, count } in rows"
        :key="`selected-${card.id}`"
        :card="card"
        :count="count"
        :interactive="canEdit || canHighlight"
        :highlighted="highlightedCardIds.has(card.id)"
        @select="handleRowSelect(card)"
        @preview="$emit('preview', card)"
        @tooltip="forwardTooltip"
        @tooltip-clear="forwardTooltipClear"
      />
    </div>
  </aside>
</template>
