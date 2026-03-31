<template>
    <div class="w-full aspect-square border-2 border-gray-300 rounded-md flex justify-center items-center">
        <CardBase v-if="card" :card="card" />
        <div v-else class="text-center">
            <p class="text-sm font-bold my-auto">{{ name }}</p>
            <!-- <p class="text-sm font-bold my-auto">{{ id }}</p> -->
        </div>
    </div>
</template>

<script setup lang="ts">
import CardBase from './CardBase.vue'
import type { Card } from '@/types/crawlv2'

const props = defineProps<{
    name: string
    card: Card | null
    id: string
}>()
</script>

<style scoped>

</style>
