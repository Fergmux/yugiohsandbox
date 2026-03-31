<template>
    <div class="flex justify-center items-center border-2 border-gray-400 rounded-md bg-opacity-50">
        <template v-if="card">
            <div v-if="rotate" class="relative w-full overflow-hidden" style="aspect-ratio: 3/2">
                <CardBase
                    :card="card"
                    class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90"
                    style="height: 150%; width: full;"
                />
            </div>
            <CardBase v-else :card="card" />
        </template>
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
    rotate?: boolean
}>()
</script>

<style scoped>

</style>
