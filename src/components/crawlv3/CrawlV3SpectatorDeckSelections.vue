<script setup lang="ts">
import CrawlV3Select from '@/components/crawlv3/CrawlV3Select.vue'
import CrawlV3SelectedCardRow from '@/components/crawlv3/CrawlV3SelectedCardRow.vue'
import type { Crawlv3SelectedCardRow } from '@/lib/crawlv3/selected-card-rows'
import type { Crawlv3CatalogCard, Crawlv3Game, Crawlv3Player } from '@/types/crawlv3'
import type { Crawlv3SpectatorPerspective } from '@/types/crawlv3-ui'

const perspective = defineModel<Crawlv3SpectatorPerspective>('perspective', { required: true })

defineProps<{
  game: Crawlv3Game | null
  perspectiveOptions: { value: Crawlv3SpectatorPerspective; label: string }[]
  playerSelectionRows: Record<Crawlv3Player, Crawlv3SelectedCardRow[]>
}>()

const emit = defineEmits<{
  (event: 'preview', card: Crawlv3CatalogCard): void
  (event: 'save-perspective', perspective: Crawlv3SpectatorPerspective): void
}>()

const playerKeys: Crawlv3Player[] = ['player1', 'player2']

function savePerspective(value: string) {
  if (value !== 'both' && value !== 'player1' && value !== 'player2') return
  emit('save-perspective', value)
}
</script>

<template>
  <div class="mt-6 rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
    <label class="block">
      <span class="mb-2 block text-sm text-white/65">Spectate</span>
      <CrawlV3Select v-model="perspective" :options="perspectiveOptions" @change="savePerspective" />
    </label>
  </div>

  <div class="mt-6 grid gap-4 xl:grid-cols-2">
    <section
      v-for="playerKey in playerKeys"
      :key="`spectator-selection-${playerKey}`"
      class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4"
    >
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold tracking-[0.25em] text-white/40 uppercase">
            {{ playerKey === 'player1' ? 'Host' : 'Player 2' }}
          </p>
          <h3 class="mt-1 text-xl font-semibold">
            {{ game?.players[playerKey]?.username ?? 'Waiting for player...' }}
          </h3>
        </div>
        <span class="rounded-full bg-black/25 px-3 py-1 text-xs font-semibold text-white/70">
          {{ game?.deckSelections[playerKey]?.cards.length ?? 0 }} cards
        </span>
      </div>

      <div
        v-if="!playerSelectionRows[playerKey].length"
        class="mt-4 rounded-[1rem] border border-white/10 bg-black/20 p-4 text-sm text-white/50"
      >
        No cards selected.
      </div>

      <div v-else class="mt-4 space-y-2">
        <CrawlV3SelectedCardRow
          v-for="{ card, count } in playerSelectionRows[playerKey]"
          :key="`spectator-selected-${playerKey}-${card.id}`"
          :card="card"
          :count="count"
          variant="readonly"
          @preview="$emit('preview', card)"
        />
      </div>
    </section>
  </div>
</template>
