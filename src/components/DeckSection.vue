<script setup lang="ts">
import type { YugiohCard } from '@/types'
import { getS3ImageUrl } from '@/utils'
import { ref } from 'vue'

defineProps<{
  cards?: YugiohCard[]
  max?: number
}>()

const emit = defineEmits<{
  (e: 'select', card: YugiohCard): void
  (e: 'remove', cardId: number): void
}>()

const moveAudio = new Audio('/card_move.mp3')
const clickingOnCard = ref<number | null>(null)
const clickOnCard = (cardId: number) => {
  clickingOnCard.value = cardId
  moveAudio.currentTime = 0
  moveAudio.play()
  emit('remove', cardId)
  setTimeout(() => {
    clickingOnCard.value = null
  }, 100)
}

const showCards = ref(true)
const toggleShowCards = () => {
  showCards.value = !showCards.value
}
</script>

<template>
  <div class="mt-4">
    <div class="flex cursor-pointer items-center gap-2" @click="toggleShowCards">
      <span class="material-symbols-outlined">{{
        showCards ? 'arrow_drop_down' : 'arrow_drop_up'
      }}</span>
      <h3 class="text-2xl font-semibold">
        <slot />
        <span class="font-normal">
          - {{ cards?.length }}<template v-if="max"> / {{ max }}</template></span
        >
      </h3>
    </div>
    <div v-if="showCards" class="mt-2">
      <ul
        class="grid-cols-auto grid grid-cols-[repeat(auto-fill,minmax(50px,100px))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(75px,125px))] md:grid-cols-[repeat(auto-fill,minmax(100px,150px))] lg:grid-cols-[repeat(auto-fill,minmax(100px,200px))] 2xl:grid-cols-[repeat(auto-fill,minmax(100px,250px))]"
      >
        <li
          v-for="(card, index) in cards"
          v-memo="[card.id, clickingOnCard]"
          :key="`${card.id}+${index}`"
          class="flex cursor-pointer justify-center transition-transform duration-75"
          :style="{ transform: `scale(${clickingOnCard === card.id ? 0.95 : 1})` }"
        >
          <img
            @dragstart.prevent=""
            @click.right.prevent="emit('select', card)"
            @click="clickOnCard(card.id)"
            :src="getS3ImageUrl(card.id)"
            :alt="card.name"
            class="w-full max-w-[300px] min-w-[100px]"
          />
        </li>
      </ul>
    </div>
  </div>
</template>
