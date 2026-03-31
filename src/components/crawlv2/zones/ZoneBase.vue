<template>
    <div class="flex justify-center items-center border-2 border-gray-400 rounded-md bg-opacity-50">
        <CardBase v-if="card" :card="card" />
        <div v-else class="text-center">
            <p class="text-sm font-bold my-auto">{{ name }}</p>
            <!-- <p class="text-sm font-bold my-auto">{{ id }}</p> -->
        </div>
    </div>
</template>

<script setup lang="ts">
import CardBase from '@/components/crawlv2/CardBase.vue'
import type { Card } from '@/types/crawlv2'

const props = defineProps<{
    name: string
    card: Card | null
    id: string
}>()
</script>

<style scoped>

</style>
