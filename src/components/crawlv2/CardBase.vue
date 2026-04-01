<template>
  <div
    :style="{ backgroundImage: `url(${card.image})` }"
    class="relative flex aspect-2/3 h-full items-center justify-center rounded-md border-2 border-gray-300 bg-contain bg-center bg-no-repeat text-xl font-bold text-black"
  >
    <p class="absolute top-[6%] left-[12%] text-xs font-bold" :class="{ 'text-white': isTrapOrEffect }">
      {{ card.name }}
    </p>
    <p class="absolute bottom-[8%] left-[21%] text-xs font-bold text-white">{{ card.atk }}</p>
    <p class="absolute right-[21%] bottom-[8%] text-xs font-bold text-white">{{ card.def }}</p>
    <p class="absolute top-[5%] right-[10%] text-sm font-bold text-white">{{ card.cost }}</p>
    <p class="absolute top-[65%] left-[13%] text-[7px]">{{ card.race }}-{{ card.damage }}</p>
    <p class="absolute top-[72%] left-[13%] text-[7px]" :class="{ 'text-white': isTrapOrEffect }">
      {{ card.description }} - {{ card.effect }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { type GameCard } from '@/types/cards'
import { computed } from 'vue'

const props = defineProps<{
  card: GameCard
}>()

const isTrapOrEffect = computed(() => ['trap', 'effect'].includes(props.card.type ?? ''))
</script>
