<template>
    <div   :style="{ backgroundImage: `url(${card.image})` }" class="bg-contain bg-center bg-no-repeat h-full aspect-2/3 border-2 border-gray-300 rounded-md flex justify-center items-center text-white text-xl font-bold">
        {{ card.name }}
    </div>
</template>

<script setup lang="ts">
import type { Card } from '@/types/crawlv2'

const props = defineProps<{
    card: Card
}>()
</script>