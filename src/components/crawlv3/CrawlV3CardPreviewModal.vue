<script setup lang="ts">
import type { Crawlv3CardState } from '@/types/crawlv3'

import cardBackImage from '@/assets/images/cards/cardback.png'

defineProps<{
  card: Crawlv3CardState
  showFace: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[1000] bg-black/80 p-4 backdrop-blur-sm" @click="emit('close')">
      <div class="mx-auto grid h-full max-w-6xl items-center gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div class="flex justify-center">
          <img
            :src="showFace ? card.imageUrl || cardBackImage : cardBackImage"
            :alt="showFace ? card.title : 'Face-down card'"
            class="max-h-[85vh] rounded-[1.5rem] border border-white/15 bg-neutral-950 object-contain shadow-2xl"
            @click.stop
          />
        </div>

        <div class="rounded-[1.75rem] border border-white/10 bg-neutral-950/90 p-6 text-white shadow-2xl" @click.stop>
          <p class="text-xs font-semibold tracking-[0.35em] text-white/45 uppercase">Card Preview</p>
          <h2 class="mt-3 text-3xl font-semibold">{{ showFace ? card.title : 'Face-down card' }}</h2>

          <div v-if="showFace" class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-2xl bg-white/5 p-3">
              <p class="text-xs text-white/50 uppercase">Cost</p>
              <p class="mt-1 text-lg font-semibold">{{ card.cost || '-' }}</p>
            </div>
            <div class="rounded-2xl bg-white/5 p-3">
              <p class="text-xs text-white/50 uppercase">ATK</p>
              <p class="mt-1 text-lg font-semibold">{{ card.atk || '-' }}</p>
            </div>
            <div class="rounded-2xl bg-white/5 p-3">
              <p class="text-xs text-white/50 uppercase">DEF</p>
              <p class="mt-1 text-lg font-semibold">{{ card.def || '-' }}</p>
            </div>
            <div class="rounded-2xl bg-white/5 p-3">
              <p class="text-xs text-white/50 uppercase">Race</p>
              <p class="mt-1 text-lg font-semibold">{{ card.race || '-' }}</p>
            </div>
          </div>

          <div v-if="showFace" class="mt-6 space-y-3">
            <div>
              <p class="text-xs text-white/50 uppercase">Damage Type</p>
              <p class="mt-1 text-lg font-medium">{{ card.damageType || '-' }}</p>
            </div>
            <div>
              <p class="text-xs text-white/50 uppercase">Description</p>
              <p class="mt-1 whitespace-pre-wrap text-white/88">{{ card.description || 'No description provided.' }}</p>
            </div>
          </div>

          <button
            type="button"
            class="mt-8 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/5"
            @click="emit('close')"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
