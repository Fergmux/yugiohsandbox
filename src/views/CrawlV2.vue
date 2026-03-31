<template>
    <div class="grid grid-cols-7 gap-4 max-w-7xl mx-auto select-none">
        <FieldZone
            v-for="(id, index) in fieldLayout"
            class="col-span-1"
            :class="{ 
                'ring-2 ring-yellow-400': id === selectedCardLocation ,
                [locations[id].colour]: true
            }"
            :key="`${id}-${index}`"
            :name="locations[id].name"
            :card="getCard(id)"
            :id="id"
            @mousedown="selectCard(id)"
            @mouseup="moveCard(id)"
        />
    </div>
</template>

<script setup lang="ts">
import FieldZone from '@/components/crawlv2/FieldZone.vue'
import HandCard from '@/components/crawlv2/HandCard.vue'
import { fieldLayout, locations, type Location } from '@/types/crawlv2'
import cardImg from '@/assets/images/card.png'
import type { Card } from '@/types/crawlv2'
import { ref, type Ref } from 'vue'

const selectedCard = ref<Card | null>(null)
const selectedCardLocation = ref<Location | null>(null)

const getCard = (id: Location | null) => {
    return id && (gameState.value.locations[id]?.card ?? null)
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
        'monster11': {
            card: {
                name: 'Card 1',
                image: cardImg,
            },
        },
        'monster12': {
            card: {
                name: 'Card 2',
                image: cardImg,
            },
        },
        'monster23': {
            card: {
                name: 'Card 3',
                image: cardImg,
            },
        },
        'monster24': {
            card: {
                name: 'Card 4',
                image: cardImg,
            },
        },
        'hand11': {
            card: {
                name: 'Card 1',
                image: cardImg,
            },
        },
        'hand12': {
            card: {
                name: 'Card 2',
                image: cardImg,
            },
        },
    }
})
</script>

<style scoped>

</style>
