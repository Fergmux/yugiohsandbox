<script setup lang="ts">
import type { YugiohCard } from '@/types'

defineProps<{
  card?: YugiohCard | null
  selected?: boolean
  faceDown?: boolean
  hint?: string | number
  actions?: false | string[]
}>()
const emit = defineEmits<{
  (e: 'action', name: string): void
}>()

const getS3ImageUrl = (cardId: number): string =>
  `${import.meta.env.VITE_S3_BUCKET_URL}${cardId}.jpg`
</script>

<template>
  <div class="relative aspect-square border-1 border-gray-300">
    <img
      v-if="card"
      class="m-auto max-h-full"
      :class="{
        'border-4 border-yellow-200': selected,
        'rotate-90': card.defense,
      }"
      :src="getS3ImageUrl(card?.faceDown ? 0 : card?.id)"
    />
    <div
      class="absolute top-0 left-0 flex h-full w-full items-end justify-center opacity-0 hover:opacity-100"
    >
      <p v-if="hint" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {{ hint }}
      </p>
      <div v-if="actions">
        <button
          v-for="action in actions"
          :key="action"
          @click.stop="emit('action', action)"
          class="m-2 rounded-md border-1 border-gray-300 bg-gray-400 p-2 text-black"
        >
          {{ action }}
        </button>
      </div>
    </div>
  </div>
</template>
