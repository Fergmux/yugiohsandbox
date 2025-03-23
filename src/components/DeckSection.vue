<script setup lang="ts">
import type { YugiohCard } from '@/types'
import { getS3ImageUrl } from '@/utils'
import { ref } from 'vue'

defineProps<{
  cards?: YugiohCard[]
  max: number
}>()

const emit = defineEmits<{
  (e: 'select', card: YugiohCard): void
  (e: 'remove', cardId: number): void
}>()

const moveAudio = new Audio('/card_move.mp3')
const clickingOnCard = ref<number | null>(null)
const clickOnCard = (index: number) => {
  clickingOnCard.value = index
  moveAudio.currentTime = 0
  moveAudio.play()
}

const unclick = () => {
  clickingOnCard.value = null
}
</script>

<template>
  <div class="mt-4">
    <h3 class="text-2xl font-semibold">
      <slot /> <span v-if="max" class="font-normal"> - {{ cards?.length }}/{{ max }}</span>
    </h3>
    <div class="mt-2">
      <ul
        class="grid-cols-auto grid grid-cols-[repeat(auto-fill,minmax(100px,150px))] gap-2 lg:grid-cols-[repeat(auto-fill,minmax(100px,200px))] 2xl:grid-cols-[repeat(auto-fill,minmax(100px,250px))]"
      >
        <li
          v-for="(card, index) in cards"
          v-memo="[card.id, clickingOnCard]"
          :key="`${card.id}${index}`"
          class="flex cursor-pointer justify-center transition-transform duration-75"
          :style="{ transform: `scale(${clickingOnCard === index ? 0.95 : 1})` }"
        >
          <img
            @dragstart.prevent=""
            @click.right.prevent="emit('select', card)"
            @click="emit('remove', card.id)"
            @mousedown.left="clickOnCard(index)"
            @mouseup.left="unclick"
            :src="getS3ImageUrl(card.id)"
            :alt="card.name"
            class="w-full max-w-[300px] min-w-[100px]"
          />
        </li>
      </ul>
    </div>
  </div>
</template>
