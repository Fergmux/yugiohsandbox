<template>
  <div class="flex h-screen w-screen items-center justify-center">
    <div
      class="mx-auto grid w-[130vh] grid-cols-[2fr_2fr_3fr_3fr_3fr_2fr_2fr] grid-rows-[3fr_2fr_3fr_3fr_0.5fr_3fr_3fr_2fr_3fr] gap-x-[min(80px,3vh)] gap-y-2 bg-cover bg-center bg-no-repeat px-[min(15vw,30vh)] py-[5vh] select-none"
      :style="{ backgroundImage: `url(${playspaceImg})` }"
    >
      <FieldZone
        v-for="(id, index) in fieldLayout"
        class="col-span-1"
        :class="{
          'ring-2 ring-yellow-400': id === selectedCardLocation,
        }"
        :key="`${id}-${index}`"
        :name="locations[id].name"
        :card="getCard(id)"
        :type="locations[id].type"
        :id="id"
        @mousedown="selectCard(id)"
        @mouseup="moveCard(id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import FieldZone from '@/components/crawlv2/zones/FieldZone.vue'
import { fieldLayout, locations, type Location } from '@/types/crawlv2'
import cardImg from '@/assets/images/card.png'
import playspaceImg from '@/assets/images/playspace.png'
import type { Card } from '@/types/crawlv2'
import { ref, type Ref } from 'vue'

const selectedCard = ref<Card | null>(null)
const selectedCardLocation = ref<Location | null>(null)

const getCard = (id: Location | null): Card | null => {
  if (!id) return null
  return gameState.value.locations[id]?.card ?? null
}

const setCard = (id: Location) => {
  if (selectedCard.value) gameState.value.locations[id] = { card: selectedCard.value }
}

const removeCard = (id: Location | null) => {
  if (id) delete gameState.value.locations[id]
}

const selectCard = (id: Location | null) => {
  selectedCard.value = getCard(id)
  selectedCardLocation.value = id
}

const moveCard = (id: Location) => {
  if (id === selectedCardLocation.value) return
  if (getCard(id)) return
  removeCard(selectedCardLocation.value)
  setCard(id)
  selectCard(null)
}

const gameState: Ref<{ locations: Partial<Record<Location, { card: Card }>> }> = ref({
  locations: {
    unit11: {
      card: {
        name: 'Card 1',
        image: cardImg,
      },
    },
    unit12: {
      card: {
        name: 'Card 2',
        image: cardImg,
      },
    },
    unit23: {
      card: {
        name: 'Card 3',
        image: cardImg,
      },
    },
    unit24: {
      card: {
        name: 'Card 4',
        image: cardImg,
      },
    },
    hand11: {
      card: {
        name: 'Card 5',
        image: cardImg,
      },
    },
    hand12: {
      card: {
        name: 'Card 6',
        image: cardImg,
      },
    },
  },
})
</script>

<style scoped></style>
