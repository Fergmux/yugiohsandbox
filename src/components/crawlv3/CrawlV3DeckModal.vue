<script setup lang="ts">
import { computed, ref } from 'vue'

import CrawlV3Card from '@/components/crawlv3/CrawlV3Card.vue'
import CrawlV3CardPreviewModal from '@/components/crawlv3/CrawlV3CardPreviewModal.vue'
import type { Crawlv3CardState } from '@/types/crawlv3'

const props = defineProps<{
  title: string
  cards: Crawlv3CardState[]
  interactive?: boolean
  allowMoveToDeck?: boolean
  allowMoveToDiscard?: boolean
  statusLabels?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'move-to-hand', instanceId: string): void
  (e: 'move-to-table', instanceId: string): void
  (e: 'move-to-deck', instanceId: string): void
  (e: 'move-to-discard', instanceId: string): void
}>()

const search = ref('')
const previewCard = ref<Crawlv3CardState | null>(null)

const uniqueCards = computed(() => {
  const seen = new Set<string>()

  return props.cards.filter((card) => {
    if (seen.has(card.instanceId)) return false
    seen.add(card.instanceId)
    return true
  })
})

const filteredCards = computed(() => {
  if (!search.value.trim()) return uniqueCards.value
  const query = search.value.trim().toLowerCase()
  return uniqueCards.value.filter((card) =>
    [card.title, card.cardId, card.description, card.race, card.damageType].join(' ').toLowerCase().includes(query),
  )
})

const buttonClasses = {
  hand: 'rounded-full border border-sky-300/35 bg-sky-300/15 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:border-sky-300/55 hover:bg-sky-300/25 disabled:cursor-not-allowed disabled:opacity-50',
  table:
    'rounded-full border border-amber-300/35 bg-amber-300/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:border-amber-300/55 hover:bg-amber-300/25 disabled:cursor-not-allowed disabled:opacity-50',
  deck: 'rounded-full border border-indigo-300/35 bg-indigo-300/15 px-3 py-1.5 text-xs font-semibold text-indigo-100 transition hover:border-indigo-300/55 hover:bg-indigo-300/25 disabled:cursor-not-allowed disabled:opacity-50',
  discard:
    'rounded-full border border-rose-300/35 bg-rose-300/15 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:border-rose-300/55 hover:bg-rose-300/25 disabled:cursor-not-allowed disabled:opacity-50',
} as const
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[1000] bg-black/75 p-4 backdrop-blur-sm" @click="emit('close')">
      <div
        class="mx-auto flex h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] min-h-0 max-w-7xl flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-neutral-950/95 p-6 text-white shadow-2xl"
        @click.stop
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Pile View</p>
            <h2 class="mt-2 text-2xl font-semibold">{{ title }}</h2>
            <p class="mt-1 text-sm text-white/60">{{ cards.length }} cards</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <input
              v-model="search"
              type="text"
              placeholder="Search pile"
              class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-amber-300/50"
            />
            <button
              type="button"
              class="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
              @click="emit('close')"
            >
              Close
            </button>
          </div>
        </div>

        <div class="mt-6 min-h-0 flex-1 overflow-hidden">
          <div
            class="grid h-full grid-cols-1 content-start gap-4 overflow-y-auto pr-2 sm:[grid-template-columns:repeat(auto-fill,minmax(13rem,13rem))] sm:justify-start"
          >
            <div
              v-for="card in filteredCards"
              :key="card.instanceId"
              class="rounded-[1.5rem] border border-white/10 bg-white/5 p-3 sm:w-[13rem]"
              :title="`${card.title}\nID: ${card.cardId}\nCost: ${card.cost || '-'}\nATK: ${card.atk || '-'}\nDEF: ${card.def || '-'}\n${card.description || ''}`"
            >
              <div class="flex justify-center">
                <CrawlV3Card
                  :card="card"
                  :show-face="true"
                  :status-labels="statusLabels"
                  @contextmenu.prevent="previewCard = card"
                  @mouseenter.stop
                  @mousemove.stop
                  @mouseleave.stop
                />
              </div>

              <div v-if="interactive" class="mt-3 flex flex-wrap gap-2">
                <button
                  v-if="allowMoveToDeck"
                  type="button"
                  :class="buttonClasses.deck"
                  @click="emit('move-to-deck', card.instanceId)"
                >
                  Move to Deck
                </button>
                <button
                  v-if="allowMoveToDiscard"
                  type="button"
                  :class="buttonClasses.discard"
                  @click="emit('move-to-discard', card.instanceId)"
                >
                  Move to Discard
                </button>
                <button type="button" :class="buttonClasses.hand" @click="emit('move-to-hand', card.instanceId)">
                  Move to Hand
                </button>
                <button type="button" :class="buttonClasses.table" @click="emit('move-to-table', card.instanceId)">
                  Move to Table
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CrawlV3CardPreviewModal v-if="previewCard" :card="previewCard" :show-face="true" @close="previewCard = null" />
    </div>
  </Teleport>
</template>
